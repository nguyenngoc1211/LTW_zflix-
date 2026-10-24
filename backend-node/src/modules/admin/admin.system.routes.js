import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";

export const adminSystemRouter = Router();

adminSystemRouter.use(requireAuth);

// Watch party: admin + moderator được thao tác
const requireStaff = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

// Kinh doanh / nhật ký / cài đặt: chỉ admin
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

// ---------------------------------------------------------------------------
// GET /parties — danh sách phòng watch party đang hoạt động
// ---------------------------------------------------------------------------
adminSystemRouter.get(
  "/parties",
  requireStaff,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT wp.id, wp.title, wp.status, wp.max_participants, wp.created_at, wp.expires_at,
              p.title AS production_title, u.username AS host_name,
              (SELECT COUNT(*) FROM watch_party_participants wpp WHERE wpp.party_id = wp.id) AS participant_count,
              (SELECT COUNT(*) FROM watch_party_chats wpc WHERE wpc.party_id = wp.id) AS chat_count
       FROM watch_parties wp
       JOIN productions p ON p.id = wp.production_id
       JOIN users u ON u.id = wp.host_id
       ORDER BY wp.created_at DESC LIMIT 50`,
    );
    res.json({ items: rows });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /parties/:id/end — kết thúc phòng (moderator/admin dừng phòng vi phạm)
// ---------------------------------------------------------------------------
adminSystemRouter.patch(
  "/parties/:id/end",
  requireStaff,
  asyncHandler(async (req, res) => {
    const partyId = typeof req.params.id === "string" ? req.params.id.toUpperCase() : "";
    if (!/^[A-Z0-9]{4,20}$/.test(partyId)) return res.status(400).json({ message: "party id không hợp lệ" });
    const [result] = await pool.execute("UPDATE watch_parties SET status = 'ended' WHERE id = ? AND status IN ('waiting','playing','paused')", [partyId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Phòng không tồn tại hoặc đã kết thúc" });
    res.json({ id: partyId, status: "ended" });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /parties/:id — xóa hẳn phòng + chat + thành viên
// ---------------------------------------------------------------------------
adminSystemRouter.delete(
  "/parties/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const partyId = typeof req.params.id === "string" ? req.params.id.toUpperCase() : "";
    if (!/^[A-Z0-9]{4,20}$/.test(partyId)) return res.status(400).json({ message: "party id không hợp lệ" });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM watch_party_chats WHERE party_id = ?", [partyId]);
      await connection.execute("DELETE FROM watch_party_participants WHERE party_id = ?", [partyId]);
      const [result] = await connection.execute("DELETE FROM watch_parties WHERE id = ?", [partyId]);
      await connection.commit();
      if (!result.affectedRows) { connection.release(); return res.status(404).json({ message: "Party not found" }); }
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    connection.release();
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// GET /subscriptions — gói đăng ký active + doanh thu theo tháng
// ---------------------------------------------------------------------------
adminSystemRouter.get(
  "/subscriptions",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [monthly] = await pool.execute(
      `SELECT DATE_FORMAT(vip_end_date, '%Y-%m') AS month, COUNT(*) AS transactions,
              SUM(final_amount) AS revenue
       FROM transactions WHERE status = 'success' AND vip_end_date IS NOT NULL
       GROUP BY month ORDER BY month ASC LIMIT 12`,
    );
    const [subs] = await pool.execute(
      `SELECT us.id, us.start_date, us.end_date, us.status, us.auto_renew,
              u.username, u.email, u.vip_expires_at, sp.name AS plan_name, sp.duration_days
       FROM user_subscriptions us
       JOIN users u ON u.id = us.user_id
       JOIN subscription_plans sp ON sp.id = us.plan_id
       ORDER BY us.created_at DESC LIMIT 30`,
    );
    const [plans] = await pool.execute("SELECT id, name, duration_days, price, discount_price, is_active FROM subscription_plans ORDER BY display_order");
    res.json({
      monthly: monthly.map((row) => ({ ...row, revenue: Number(row.revenue), transactions: Number(row.transactions) })),
      subscriptions: subs,
      plans,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /users/:id/vip — kích hoạt VIP thủ công cho user (ghi giao dịch + subscription)
// ---------------------------------------------------------------------------
adminSystemRouter.post(
  "/users/:id/vip",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = parsePositiveInt(req.params.id, "user id");
    const days = Math.min(3650, Math.max(1, Number(req.body?.days) || 30));
    const planId = Number(req.body?.planId) || null;

    const [users] = await pool.execute("SELECT id, username, vip_expires_at FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!users.length) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const currentVip = users[0].vip_expires_at ? new Date(users[0].vip_expires_at) : null;
    const base = currentVip && currentVip > now ? currentVip : now;
    const endDate = new Date(base.getTime() + days * 86400000);

    let planName = `Gói VIP ${days} ngày (admin cấp)`;
    let amount = 0;
    if (planId) {
      const [plans] = await pool.execute("SELECT id, name, duration_days, discount_price FROM subscription_plans WHERE id = ? LIMIT 1", [planId]);
      if (plans.length) { planName = plans[0].name; amount = Number(plans[0].discount_price); }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE users SET vip_expires_at = ? WHERE id = ?", [endDate, userId]);
      const transactionCode = `ADMIN-${Date.now().toString(36).toUpperCase()}`;
      const [txResult] = await connection.execute(
        `INSERT INTO transactions (transaction_code, user_id, plan_id, amount, discount_amount, final_amount, status, payment_method, vip_start_date, vip_end_date)
         VALUES (?, ?, ?, ?, 0, ?, 'success', 'credit_card', ?, ?)`,
        [transactionCode, userId, planId, amount, amount, base, endDate],
      );
      await connection.execute(
        `INSERT INTO user_subscriptions (user_id, plan_id, transaction_id, start_date, end_date, status, auto_renew)
         VALUES (?, ?, ?, ?, ?, 'active', 0)`,
        [userId, planId, txResult.insertId, base, endDate],
      );
      await connection.execute(
        `INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id)
         VALUES (?, 'Quyền VIP đã được kích hoạt', ?, 'vip', 'user', ?)`,
        [userId, `Tài khoản của bạn được kích hoạt ${planName}, hiệu lực đến ${endDate.toLocaleDateString("vi-VN")}.`, userId],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    connection.release();
    res.json({ userId, username: users[0].username, vipExpiresAt: endDate, days });
  }),
);

// ---------------------------------------------------------------------------
// GET /security-events — nhật ký bảo mật (lọc theo loại sự kiện)
// ---------------------------------------------------------------------------
adminSystemRouter.get(
  "/security-events",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination({ ...req.query, limit: req.query.limit || 20 });
    const event = typeof req.query.event === "string" && req.query.event.trim() ? req.query.event.trim() : "";
    const where = event ? "WHERE event = ?" : "";
    const params = event ? [event] : [];
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM security_events ${where}`, params);
    const [rows] = await pool.execute(
      `SELECT se.id, se.event, se.user_id, se.session_id, se.ip, se.user_agent, se.reason, se.created_at,
              u.username
       FROM security_events se LEFT JOIN users u ON u.id = se.user_id
       ${where} ORDER BY se.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ items: rows, page, limit, total: countRows[0].total, pages: Math.max(1, Math.ceil(countRows[0].total / limit)) });
  }),
);

const csvValue = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  return String(value ?? "");
};

// ---------------------------------------------------------------------------
// GET /export/users.csv — xuất danh sách người dùng
// ---------------------------------------------------------------------------
adminSystemRouter.get(
  "/export/users.csv",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      "SELECT id, username, email, role, status, vip_expires_at, created_at, last_login FROM users ORDER BY id",
    );
    const header = "id,username,email,role,status,vip_expires_at,created_at,last_login";
    const lines = rows.map((row) =>
      [row.id, row.username, row.email, row.role, row.status, row.vip_expires_at ?? "", row.created_at ?? "", row.last_login ?? ""]
        .map((value) => `"${csvValue(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="zflix-users.csv"');
    res.send(`\uFEFF${[header, ...lines].join("\n")}`);
  }),
);

// ---------------------------------------------------------------------------
// GET /export/transactions.csv — xuất giao dịch
// ---------------------------------------------------------------------------
adminSystemRouter.get(
  "/export/transactions.csv",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(
      `SELECT t.id, t.transaction_code, u.username, sp.name AS plan_name, t.final_amount, t.status, t.payment_method, t.vip_start_date, t.vip_end_date, t.created_at
       FROM transactions t JOIN users u ON u.id = t.user_id LEFT JOIN subscription_plans sp ON sp.id = t.plan_id
       ORDER BY t.created_at DESC`,
    );
    const header = "id,transaction_code,username,plan_name,final_amount,status,payment_method,vip_start_date,vip_end_date,created_at";
    const lines = rows.map((row) =>
      [row.id, row.transaction_code, row.username, row.plan_name ?? "", row.final_amount, row.status, row.payment_method, row.vip_start_date ?? "", row.vip_end_date ?? "", row.created_at ?? ""]
        .map((value) => `"${csvValue(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="zflix-transactions.csv"');
    res.send(`\uFEFF${[header, ...lines].join("\n")}`);
  }),
);

// ---------------------------------------------------------------------------
// GET/PUT /settings/featured — banner phim nổi bật trên trang chủ
// ---------------------------------------------------------------------------
adminSystemRouter.get(
  "/settings/featured",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.execute("SELECT setting_value FROM app_settings WHERE setting_key = 'featured_production_id' LIMIT 1");
    const productionId = rows.length ? Number(rows[0].setting_value) : null;
    if (!productionId) return res.json({ featuredProductionId: null });
    const [productions] = await pool.execute(
      "SELECT id, title, description, banner_url, poster_url, release_year FROM productions WHERE id = ? LIMIT 1",
      [productionId],
    );
    res.json({ featuredProductionId: productionId, production: productions[0] || null });
  }),
);

adminSystemRouter.put(
  "/settings/featured",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (body.productionId === null || body.productionId === "") {
      await pool.execute("DELETE FROM app_settings WHERE setting_key = 'featured_production_id'");
      return res.json({ featuredProductionId: null });
    }
    const productionId = parsePositiveInt(body.productionId, "production id");
    const [existing] = await pool.execute("SELECT id FROM productions WHERE id = ? LIMIT 1", [productionId]);
    if (!existing.length) return res.status(404).json({ message: "Production not found" });
    await pool.execute(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('featured_production_id', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [String(productionId)],
    );
    res.json({ featuredProductionId: productionId });
  }),
);
