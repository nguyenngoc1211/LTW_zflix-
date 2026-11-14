import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { fromMongo, mongoCollection, nextNumericId, withMongoTransaction } from "../../core/database/mongo.js";
import { createNotification, emitStoredNotification, ensureNotificationIndexes } from '../community/notification.service.js';
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";

export const adminSystemRouter = Router();
const useMongo = () => process.env.DATA_STORE === "mongodb";
const numeric = (value) => Number(value?.toString?.() ?? value ?? 0);

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
    if (useMongo()) {
      const [parties, productions, users, participants, chats] = await Promise.all([
        (await mongoCollection("watch_parties")).find({}).sort({ created_at: -1 }).limit(50).toArray(),
        (await mongoCollection("productions")).find({}).toArray(),
        (await mongoCollection("users")).find({}).toArray(),
        (await mongoCollection("watch_party_participants")).find({}).toArray(),
        (await mongoCollection("watch_party_chats")).find({}).toArray(),
      ]);
      const titles = new Map(productions.map((row) => [row.id, row.title]));
      const usernames = new Map(users.map((row) => [row.id, row.username]));
      const items = parties.filter((row) => titles.has(row.production_id) && usernames.has(row.host_id))
        .map((row) => ({ id: row.id, title: row.title, status: row.status,
          max_participants: row.max_participants, created_at: row.created_at,
          expires_at: row.expires_at, production_title: titles.get(row.production_id),
          host_name: usernames.get(row.host_id),
          participant_count: participants.filter((item) => item.party_id === row.id).length,
          chat_count: chats.filter((item) => item.party_id === row.id).length }));
      return res.json({ items });
    }
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
    if (useMongo()) {
      const result = await (await mongoCollection("watch_parties")).updateOne({ id: partyId,
        status: { $in: ["waiting", "playing", "paused"] } }, { $set: { status: "ended" } });
      if (!result.matchedCount) return res.status(404).json({ message: "Phòng không tồn tại hoặc đã kết thúc" });
      return res.json({ id: partyId, status: "ended" });
    }
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
    if (useMongo()) {
      const deleted = await withMongoTransaction(async (session) => {
        await (await mongoCollection("watch_party_chats")).deleteMany({ party_id: partyId }, { session });
        await (await mongoCollection("watch_party_participants")).deleteMany({ party_id: partyId }, { session });
        return (await (await mongoCollection("watch_parties")).deleteOne({ id: partyId }, { session })).deletedCount;
      });
      if (!deleted) return res.status(404).json({ message: "Party not found" });
      return res.status(204).end();
    }
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
    if (useMongo()) {
      const [transactions, subscriptions, plans, users] = await Promise.all([
        (await mongoCollection("transactions")).find({ status: { $in: ["success", "PAID"] },
          vip_end_date: { $ne: null } }).toArray(),
        (await mongoCollection("user_subscriptions")).find({}).sort({ created_at: -1 }).limit(30).toArray(),
        (await mongoCollection("subscription_plans")).find({}).sort({ display_order: 1 }).toArray(),
        (await mongoCollection("users")).find({}).toArray(),
      ]);
      const byMonth = new Map();
      for (const transaction of transactions) {
        const month = new Date(transaction.vip_end_date).toISOString().slice(0, 7);
        const summary = byMonth.get(month) || { month, transactions: 0, revenue: 0 };
        summary.transactions += 1;
        summary.revenue += numeric(transaction.final_amount);
        byMonth.set(month, summary);
      }
      const userById = new Map(users.map((row) => [row.id, row]));
      const planById = new Map(plans.map((row) => [row.id, row]));
      return res.json({ monthly: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(0, 12),
        subscriptions: subscriptions.flatMap((row) => {
          const user = userById.get(row.user_id);
          const plan = planById.get(row.plan_id);
          return user && plan ? [{ id: row.id, start_date: row.start_date,
            end_date: row.end_date, status: row.status, auto_renew: row.auto_renew,
            username: user.username, email: user.email, vip_expires_at: user.vip_expires_at,
            plan_name: plan.name, duration_days: plan.duration_days }] : [];
        }), plans: plans.map((row) => ({ id: row.id, name: row.name,
          duration_days: row.duration_days, billing_months: row.billing_months,
          price: numeric(row.price),
          discount_price: numeric(row.discount_price), is_active: row.is_active })) });
    }
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
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 5 || reason.length > 500) return res.status(400).json({ message: "Lý do cấp VIP cần 5–500 ký tự" });

    if (useMongo()) {
      await ensureNotificationIndexes();
      const users = await mongoCollection("users");
      const result = await withMongoTransaction(async (session) => {
        const user = await users.findOne({ id: userId }, { session });
        if (!user) return null;
        const now = new Date();
        const currentVip = user.vip_expires_at ? new Date(user.vip_expires_at) : null;
        const base = currentVip && currentVip > now ? currentVip : now;
        const endDate = new Date(base.getTime() + days * 86400000);
        const plan = planId ? await (await mongoCollection("subscription_plans"))
          .findOne({ id: planId }, { session }) : null;
        const planName = plan?.name || `Gói VIP ${days} ngày (admin cấp)`;
        const amount = 0;
        await users.updateOne({ id: userId }, { $set: { vip_expires_at: endDate } }, { session });
        const transactionId = await nextNumericId("transactions");
        await (await mongoCollection("transactions")).insertOne({ _id: transactionId,
          id: transactionId, transaction_code: `ADMIN-${Date.now().toString(36).toUpperCase()}-${transactionId}`,
          user_id: userId, plan_id: planId, amount, discount_amount: 0,
          final_amount: amount, status: "success", payment_method: "manual_grant",
          grant_reason: reason, reviewed_by: req.user.id, reviewed_at: now,
          history: [{ action: "MANUAL_GRANT", actor_id: req.user.id, at: now, reason }],
          vip_start_date: base, vip_end_date: endDate, created_at: now }, { session });
        const subscriptionId = await nextNumericId("user_subscriptions");
        await (await mongoCollection("user_subscriptions")).insertOne({ _id: subscriptionId,
          id: subscriptionId, user_id: userId, plan_id: planId,
          transaction_id: transactionId, start_date: base, end_date: endDate,
          status: "active", auto_renew: 0, created_at: now }, { session });
        const notification = await createNotification({ recipientId: userId, type: 'vip',
          title: 'Quyền VIP đã được kích hoạt',
          message: `Tài khoản của bạn được kích hoạt ${planName}, hiệu lực đến ${endDate.toLocaleDateString('vi-VN')}.`,
          entityType: 'user', entityId: userId, redirectUrl: '/settings?tab=profile',
          deduplicationKey: `vip-grant:${transactionId}`, session });
        return { userId, username: user.username, vipExpiresAt: endDate, days, notification };
      });
      if (!result) return res.status(404).json({ message: "User not found" });
      emitStoredNotification(result.notification);
      const { notification, ...response } = result;
      return res.json(response);
    }

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
      if (plans.length) { planName = plans[0].name; }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE users SET vip_expires_at = ? WHERE id = ?", [endDate, userId]);
      const transactionCode = `ADMIN-${Date.now().toString(36).toUpperCase()}`;
      const [txResult] = await connection.execute(
        `INSERT INTO transactions (transaction_code, user_id, plan_id, amount, discount_amount, final_amount, status, payment_method, vip_start_date, vip_end_date)
         VALUES (?, ?, ?, ?, 0, ?, 'success', 'manual_grant', ?, ?)`,
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
      await connection.execute(
        "INSERT INTO security_events (event, user_id, reason, factor) VALUES ('vip_manual_grant', ?, ?, 'admin')",
        [req.user.id, `target=${userId}; days=${days}; reason=${reason}`],
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
    if (useMongo()) {
      const filter = event ? { event } : {};
      const events = await mongoCollection("security_events");
      const [total, rows, users] = await Promise.all([
        events.countDocuments(filter),
        events.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).toArray(),
        (await mongoCollection("users")).find({}).toArray(),
      ]);
      const names = new Map(users.map((row) => [row.id, row.username]));
      const items = rows.map((row) => ({ id: row.id, event: row.event,
        user_id: row.user_id, session_id: row.session_id, ip: row.ip,
        user_agent: row.user_agent, reason: row.reason, created_at: row.created_at,
        username: names.get(row.user_id) ?? null }));
      return res.json({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
    }
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
    const rows = useMongo()
      ? await (await mongoCollection("users")).find({}).sort({ id: 1 }).toArray()
      : (await pool.execute(
        "SELECT id, username, email, role, status, vip_expires_at, created_at, last_login FROM users ORDER BY id",
      ))[0];
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
    let rows;
    if (useMongo()) {
      const [transactions, users, plans] = await Promise.all([
        (await mongoCollection("transactions")).find({}).sort({ created_at: -1 }).toArray(),
        (await mongoCollection("users")).find({}).toArray(),
        (await mongoCollection("subscription_plans")).find({}).toArray(),
      ]);
      const usernames = new Map(users.map((row) => [row.id, row.username]));
      const planNames = new Map(plans.map((row) => [row.id, row.name]));
      rows = transactions.filter((row) => usernames.has(row.user_id)).map((row) => ({
        ...row, username: usernames.get(row.user_id), plan_name: planNames.get(row.plan_id),
        final_amount: numeric(row.final_amount),
      }));
    } else {
      [rows] = await pool.execute(
        `SELECT t.id, t.transaction_code, u.username, sp.name AS plan_name, t.final_amount, t.status, t.payment_method, t.vip_start_date, t.vip_end_date, t.created_at
         FROM transactions t JOIN users u ON u.id = t.user_id LEFT JOIN subscription_plans sp ON sp.id = t.plan_id
         ORDER BY t.created_at DESC`,
      );
    }
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
    if (useMongo()) {
      const setting = await (await mongoCollection("app_settings"))
        .findOne({ setting_key: "featured_production_id" });
      const productionId = setting ? Number(setting.setting_value) : null;
      if (!productionId) return res.json({ featuredProductionId: null });
      const production = await (await mongoCollection("productions")).findOne({ id: productionId },
        { projection: { id: 1, title: 1, description: 1, banner_url: 1,
          poster_url: 1, release_year: 1 } });
      return res.json({ featuredProductionId: productionId, production: production ? fromMongo(production) : null });
    }
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
    if (useMongo()) {
      const settings = await mongoCollection("app_settings");
      if (body.productionId === null || body.productionId === "") {
        await settings.deleteOne({ setting_key: "featured_production_id" });
        return res.json({ featuredProductionId: null });
      }
      const productionId = parsePositiveInt(body.productionId, "production id");
      const production = await (await mongoCollection("productions")).findOne({ id: productionId });
      if (!production) return res.status(404).json({ message: "Production not found" });
      await settings.updateOne({ setting_key: "featured_production_id" },
        { $set: { setting_value: String(productionId) },
          $setOnInsert: { _id: "featured_production_id", setting_key: "featured_production_id" } },
        { upsert: true });
      return res.json({ featuredProductionId: productionId });
    }
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
