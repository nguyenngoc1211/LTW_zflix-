import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { fromMongo, mongoCollection } from "../../core/database/mongo.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";

export const adminRouter = Router();
const useMongo = () => process.env.DATA_STORE === "mongodb";
const number = (value) => Number(value?.toString?.() ?? value ?? 0);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const sumField = async (collectionName, field) => {
  const result = await (await mongoCollection(collectionName)).aggregate([
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]).next();
  return number(result?.total);
};

// Toàn bộ router yêu cầu đăng nhập; mỗi nhóm endpoint kiểm tra role riêng:
// - admin: mọi thứ; moderator: chỉ nội dung (phim/tập, stats, views)
adminRouter.use(requireAuth);

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

const requireStaff = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

// ---------------------------------------------------------------------------
// GET /stats — số liệu tổng quan cho dashboard
// ---------------------------------------------------------------------------
adminRouter.get(
  "/stats",
  requireStaff,
  asyncHandler(async (req, res) => {
    if (useMongo()) {
      const [users, productions, episodes, ratings, comments, totalViews,
        totalWatchTime, totalRevenue, recentUsers, ratingSummary] = await Promise.all([
        (await mongoCollection("users")).countDocuments(),
        (await mongoCollection("productions")).countDocuments(),
        (await mongoCollection("episodes")).countDocuments(),
        (await mongoCollection("ratings")).countDocuments(),
        (await mongoCollection("comments")).countDocuments(),
        sumField("daily_stats", "total_views"),
        sumField("daily_stats", "total_watch_time"),
        sumField("daily_stats", "total_revenue"),
        (await mongoCollection("users")).find({}, { projection: { id: 1, username: 1,
          email: 1, role: 1, status: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(5).toArray(),
        (await mongoCollection("ratings")).aggregate([
          { $group: { _id: null, avg: { $avg: "$rating" } } },
        ]).next(),
      ]);
      return res.json({ totalUsers: users, totalProductions: productions,
        totalEpisodes: episodes, totalViews, totalRatings: ratings,
        avgRating: Number(number(ratingSummary?.avg).toFixed(2)), totalComments: comments,
        totalWatchTime, totalRevenue, recentUsers: recentUsers.map(fromMongo) });
    }
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
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (useMongo()) {
      const filter = search ? { $or: [
        { username: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
      ] } : {};
      const users = await mongoCollection("users");
      const [total, rows] = await Promise.all([
        users.countDocuments(filter),
        users.find(filter, { projection: { id: 1, username: 1, email: 1,
          role: 1, status: 1, avatar_url: 1, vip_expires_at: 1,
          created_at: 1, last_login: 1 } }).sort({ created_at: -1 }).skip(offset).limit(limit).toArray(),
      ]);
      return res.json({ items: rows.map(fromMongo), page, limit, total,
        pages: Math.max(1, Math.ceil(total / limit)) });
    }
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
  requireAdmin,
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

    if (useMongo()) {
      const users = await mongoCollection("users");
      const updates = {};
      if (role !== undefined) updates.role = role;
      if (status !== undefined) {
        updates.status = status;
        updates.disabled_at = status === "disabled" ? new Date() : null;
      }
      const result = Object.keys(updates).length
        ? await users.updateOne({ id: userId }, { $set: updates })
        : { matchedCount: await users.countDocuments({ id: userId }) };
      if (!result.matchedCount) return res.status(404).json({ message: "User not found" });
      const user = await users.findOne({ id: userId }, { projection: { id: 1,
        username: 1, email: 1, role: 1, status: 1, created_at: 1 } });
      return res.json(fromMongo(user));
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
  requireStaff,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (useMongo()) {
      const filter = search ? { title: { $regex: escapeRegex(search), $options: "i" } } : {};
      const productions = await mongoCollection("productions");
      const [total, rows, episodes, history] = await Promise.all([
        productions.countDocuments(filter), productions.find(filter).toArray(),
        (await mongoCollection("episodes")).find({}, { projection: { id: 1, production_id: 1 } }).toArray(),
        (await mongoCollection("watch_history")).find({}, { projection: { episode_id: 1 } }).toArray(),
      ]);
      const episodeProduction = new Map(episodes.map((episode) => [episode.id, episode.production_id]));
      const episodeCounts = new Map();
      const viewCounts = new Map();
      for (const episode of episodes) episodeCounts.set(episode.production_id,
        (episodeCounts.get(episode.production_id) || 0) + 1);
      for (const view of history) {
        const productionId = episodeProduction.get(view.episode_id);
        if (productionId) viewCounts.set(productionId, (viewCounts.get(productionId) || 0) + 1);
      }
      const items = rows.map((row) => ({ id: row.id, type: row.type, title: row.title,
        release_year: row.release_year, status: row.status, is_premium: row.is_premium,
        rating_avg: number(row.rating_avg), rating_count: row.rating_count,
        country: row.country, poster_url: row.poster_url,
        episode_count: episodeCounts.get(row.id) || 0, view_count: viewCounts.get(row.id) || 0 }))
        .sort((a, b) => b.view_count - a.view_count || number(b.release_year) - number(a.release_year))
        .slice(offset, offset + limit);
      return res.json({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
    }
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
  requireStaff,
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
    if (useMongo()) {
      const productions = await mongoCollection("productions");
      const updates = {};
      if (premium !== undefined) updates.is_premium = Number(premium);
      if (status !== undefined) updates.status = status;
      const result = Object.keys(updates).length
        ? await productions.updateOne({ id: productionId }, { $set: updates })
        : { matchedCount: await productions.countDocuments({ id: productionId }) };
      if (!result.matchedCount) return res.status(404).json({ message: "Production not found" });
      const row = await productions.findOne({ id: productionId },
        { projection: { id: 1, title: 1, status: 1, is_premium: 1 } });
      return res.json(fromMongo(row));
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
  requireStaff,
  asyncHandler(async (req, res) => {
    if (useMongo()) {
      const [daily, history, episodes, productions, productionGenres, genres] = await Promise.all([
        (await mongoCollection("daily_stats")).find({}).sort({ stat_date: 1 }).limit(30).toArray(),
        (await mongoCollection("watch_history")).find({}).toArray(),
        (await mongoCollection("episodes")).find({}, { projection: { id: 1, production_id: 1 } }).toArray(),
        (await mongoCollection("productions")).find({}, { projection: { id: 1, title: 1,
          poster_url: 1 } }).toArray(),
        (await mongoCollection("production_genres")).find({}).toArray(),
        (await mongoCollection("genres")).find({}).toArray(),
      ]);
      const episodeProduction = new Map(episodes.map((episode) => [episode.id, episode.production_id]));
      const productionById = new Map(productions.map((production) => [production.id, production]));
      const genreById = new Map(genres.map((genre) => [genre.id, genre.name]));
      const genreIdsByProduction = new Map();
      for (const link of productionGenres) {
        const ids = genreIdsByProduction.get(link.production_id) || [];
        ids.push(link.genre_id);
        genreIdsByProduction.set(link.production_id, ids);
      }
      const productionViews = new Map();
      const genreViews = new Map();
      for (const view of history) {
        const productionId = episodeProduction.get(view.episode_id);
        if (!productionById.has(productionId)) continue;
        const item = productionViews.get(productionId) || { count: 0, completion: 0 };
        item.count += 1;
        item.completion += number(view.watched_percent);
        productionViews.set(productionId, item);
        for (const genreId of genreIdsByProduction.get(productionId) || []) {
          genreViews.set(genreId, (genreViews.get(genreId) || 0) + 1);
        }
      }
      const topProductions = [...productionViews.entries()].map(([id, item]) => ({
        id, title: productionById.get(id).title, poster_url: productionById.get(id).poster_url,
        view_count: item.count, avg_completion: Number((item.completion / item.count).toFixed(1)),
      })).sort((a, b) => b.view_count - a.view_count).slice(0, 10);
      const byGenre = [...genreViews.entries()].map(([id, view_count]) => ({
        genre: genreById.get(id), view_count,
      })).filter((item) => item.genre).sort((a, b) => b.view_count - a.view_count).slice(0, 8);
      return res.json({ daily: daily.map((row) => ({ stat_date: row.stat_date,
        total_views: number(row.total_views), new_users: row.new_users,
        active_users: row.active_users, total_watch_time: number(row.total_watch_time),
        new_subscriptions: row.new_subscriptions, total_revenue: number(row.total_revenue) })),
      topProductions, byGenre });
    }
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
