import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";

export const adminRouter = Router();

// Toàn bộ router yêu cầu đăng nhập + role admin
adminRouter.use(requireAuth, requireRole("admin"));

// ---------------------------------------------------------------------------
// GET /stats — số liệu tổng quan cho dashboard
// ---------------------------------------------------------------------------
adminRouter.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const [[users], [productions], [episodes], [views], [ratings], [comments], [watchTime], [revenue], [recentUsers]] =
      await Promise.all([
        pool.execute("SELECT COUNT(*) AS total FROM users"),
        pool.execute("SELECT COUNT(*) AS total FROM productions"),
        pool.execute("SELECT COUNT(*) AS total FROM episodes"),
        pool.execute("SELECT COALESCE(SUM(total_views), 0) AS total FROM daily_stats"),
        pool.execute("SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg FROM ratings"),
        pool.execute("SELECT COUNT(*) AS total FROM comments"),
        pool.execute("SELECT COALESCE(SUM(total_watch_time), 0) AS total FROM daily_stats"),
        pool.execute("SELECT COALESCE(SUM(total_revenue), 0) AS total FROM daily_stats"),
        pool.execute(
          "SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 5",
        ),
      ]);
    res.json({
      totalUsers: users[0].total,
      totalProductions: productions[0].total,
      totalEpisodes: episodes[0].total,
      totalViews: Number(views[0].total),
      totalRatings: ratings[0].total,
      avgRating: Number(Number(ratings[0].avg).toFixed(2)),
      totalComments: comments[0].total,
      totalWatchTime: Number(watchTime[0].total),
      totalRevenue: Number(revenue[0].total),
      recentUsers,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /users — danh sách người dùng (tìm kiếm + phân trang)
// ---------------------------------------------------------------------------
adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = "";
    const params = [];
    if (search) {
      const like = `%${search}%`;
      const [countRows] = await pool.execute(
        "SELECT COUNT(*) AS total FROM users WHERE username LIKE ? OR email LIKE ?",
        [like, like],
      );
      const [rows] = await pool.execute(
        `SELECT id, username, email, role, status, avatar_url, vip_expires_at, created_at, last_login
         FROM users WHERE username LIKE ? OR email LIKE ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [like, like, limit, offset],
      );
      return res.json({ items: rows, page, limit, total: countRows[0].total, pages: Math.max(1, Math.ceil(countRows[0].total / limit)) });
    }
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM users ${where}`, params);
    const [rows] = await pool.execute(
      `SELECT id, username, email, role, status, avatar_url, vip_expires_at, created_at, last_login
       FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ items: rows, page, limit, total: countRows[0].total, pages: Math.max(1, Math.ceil(countRows[0].total / limit)) });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /users/:id — đổi role hoặc khóa/mở khóa tài khoản
// ---------------------------------------------------------------------------
adminRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const userId = parsePositiveInt(req.params.id, "user id");
    const { role, status } = req.body || {};

    if (role !== undefined && !["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "role must be 'user' or 'admin'" });
    }
    if (status !== undefined && !["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "status must be 'active' or 'disabled'" });
    }
    // Không cho admin tự hạ/khóa chính mình để tránh khóa hết admin
    if (userId === req.user.id && ((role && role !== "admin") || (status && status !== "active"))) {
      return res.status(400).json({ message: "Không thể tự hạ quyền hoặc khóa chính mình" });
    }

    const [existing] = await pool.execute("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!existing.length) return res.status(404).json({ message: "User not found" });

    if (role) await pool.execute("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
    if (status) {
      await pool.execute("UPDATE users SET status = ?, disabled_at = ? WHERE id = ?", [
        status,
        status === "disabled" ? new Date() : null,
        userId,
      ]);
    }
    const [rows] = await pool.execute(
      "SELECT id, username, email, role, status, created_at FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    res.json(rows[0]);
  }),
);

// ---------------------------------------------------------------------------
// GET /productions — danh sách phim (tìm kiếm + phân trang + lượt xem thật)
// ---------------------------------------------------------------------------
adminRouter.get(
  "/productions",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const base = `
      FROM productions p
      LEFT JOIN episodes e ON e.production_id = p.id
      LEFT JOIN watch_history wh ON wh.episode_id = e.id`;
    const where = search ? " WHERE p.title LIKE ?" : "";
    const params = search ? [`%${search}%`] : [];
    const [countRows] = await pool.execute(`SELECT COUNT(DISTINCT p.id) AS total ${base}${where}`, params);
    const [rows] = await pool.execute(
      `SELECT p.id, p.type, p.title, p.release_year, p.status, p.is_premium,
              p.rating_avg, p.rating_count, p.country, p.poster_url,
              COUNT(DISTINCT e.id) AS episode_count,
              COUNT(wh.user_id) AS view_count
       ${base}${where}
       GROUP BY p.id
       ORDER BY view_count DESC, p.release_year DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({
      items: rows.map((row) => ({ ...row, view_count: Number(row.view_count), episode_count: Number(row.episode_count) })),
      page,
      limit,
      total: countRows[0].total,
      pages: Math.max(1, Math.ceil(countRows[0].total / limit)),
    });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /productions/:id — bật/tắt premium hoặc đổi trạng thái
// ---------------------------------------------------------------------------
adminRouter.patch(
  "/productions/:id",
  asyncHandler(async (req, res) => {
    const productionId = parsePositiveInt(req.params.id, "production id");
    const { is_premium, isPremium, status } = req.body || {};
    const premium = is_premium !== undefined ? is_premium : isPremium;
    if (premium !== undefined && typeof premium !== "boolean") {
      return res.status(400).json({ message: "is_premium must be boolean" });
    }
    if (status !== undefined && !["ongoing", "completed"].includes(status)) {
      return res.status(400).json({ message: "status must be 'ongoing' or 'completed'" });
    }
    const [existing] = await pool.execute("SELECT id FROM productions WHERE id = ? LIMIT 1", [productionId]);
    if (!existing.length) return res.status(404).json({ message: "Production not found" });

    if (premium !== undefined) await pool.execute("UPDATE productions SET is_premium = ? WHERE id = ?", [premium, productionId]);
    if (status) await pool.execute("UPDATE productions SET status = ? WHERE id = ?", [status, productionId]);
    const [rows] = await pool.execute(
      "SELECT id, title, status, is_premium FROM productions WHERE id = ? LIMIT 1",
      [productionId],
    );
    res.json(rows[0]);
  }),
);

// ---------------------------------------------------------------------------
// GET /views — thống kê lượt xem (top phim + theo ngày)
// ---------------------------------------------------------------------------
adminRouter.get(
  "/views",
  asyncHandler(async (req, res) => {
    const [daily] = await pool.execute(
      `SELECT stat_date, total_views, new_users, active_users, total_watch_time, new_subscriptions, total_revenue
       FROM daily_stats ORDER BY stat_date ASC LIMIT 30`,
    );
    const [topReal] = await pool.execute(
      `SELECT p.id, p.title, p.poster_url, COUNT(wh.user_id) AS view_count,
              COALESCE(AVG(wh.watched_percent), 0) AS avg_completion
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN productions p ON p.id = e.production_id
       GROUP BY p.id ORDER BY view_count DESC LIMIT 10`,
    );
    const [byGenre] = await pool.execute(
      `SELECT g.name AS genre, COUNT(wh.user_id) AS view_count
       FROM watch_history wh
       JOIN episodes e ON e.id = wh.episode_id
       JOIN production_genres pg ON pg.production_id = e.production_id
       JOIN genres g ON g.id = pg.genre_id
       GROUP BY g.id ORDER BY view_count DESC LIMIT 8`,
    );
    res.json({
      daily: daily.map((row) => ({ ...row, total_views: Number(row.total_views), total_revenue: Number(row.total_revenue) })),
      topProductions: topReal.map((row) => ({ ...row, view_count: Number(row.view_count), avg_completion: Number(Number(row.avg_completion).toFixed(1)) })),
      byGenre: byGenre.map((row) => ({ ...row, view_count: Number(row.view_count) })),
    });
  }),
);
