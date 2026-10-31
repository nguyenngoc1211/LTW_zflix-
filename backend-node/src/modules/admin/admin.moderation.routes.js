import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { mongoCollection, nextNumericId, withMongoTransaction } from "../../core/database/mongo.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";
import { syncProductionIndex } from "../discovery/search.service.js";

export const adminModerationRouter = Router();
const useMongo = () => process.env.DATA_STORE === "mongodb";

adminModerationRouter.use(requireAuth);

// Duyệt nội dung cộng đồng: admin + moderator
const requireStaff = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

adminModerationRouter.use(requireStaff);

// ---------------------------------------------------------------------------
// GET /comments — danh sách bình luận mới nhất (tìm kiếm theo nội dung/phim)
// ---------------------------------------------------------------------------
adminModerationRouter.get(
  "/comments",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination(req.query);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (useMongo()) {
      const [comments, users, productions] = await Promise.all([
        (await mongoCollection("comments")).find({}).sort({ created_at: -1 }).toArray(),
        (await mongoCollection("users")).find({}).toArray(),
        (await mongoCollection("productions")).find({}).toArray(),
      ]);
      const usernames = new Map(users.map((user) => [user.id, user.username]));
      const titles = new Map(productions.map((production) => [production.id, production.title]));
      const matching = comments.filter((comment) => !search ||
        comment.content?.toLowerCase().includes(search.toLowerCase()) ||
        titles.get(comment.production_id)?.toLowerCase().includes(search.toLowerCase()));
      const items = matching.slice(offset, offset + limit).flatMap((comment) =>
        usernames.has(comment.user_id) && titles.has(comment.production_id)
          ? [{ id: comment.id, content: comment.content, status: comment.status,
            is_toxic: comment.is_toxic, created_at: comment.created_at,
            updated_at: comment.updated_at, username: usernames.get(comment.user_id),
            production_title: titles.get(comment.production_id), production_id: comment.production_id }]
          : []);
      return res.json({ items, page, limit, total: matching.length,
        pages: Math.max(1, Math.ceil(matching.length / limit)) });
    }
    const where = "";
    const params = [];
    if (search) {
      const like = `%${search}%`;
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM comments c JOIN productions p ON p.id = c.production_id
         WHERE c.content LIKE ? OR p.title LIKE ?`,
        [like, like],
      );
      const [rows] = await pool.execute(
        `SELECT c.id, c.content, c.status, c.is_toxic, c.created_at, c.updated_at, u.username, p.title AS production_title, p.id AS production_id
         FROM comments c JOIN users u ON u.id = c.user_id JOIN productions p ON p.id = c.production_id
         WHERE c.content LIKE ? OR p.title LIKE ?
         ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
        [like, like, limit, offset],
      );
      return res.json({ items: rows, page, limit, total: countRows[0].total, pages: Math.max(1, Math.ceil(countRows[0].total / limit)) });
    }
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM comments ${where}`, params);
    const [rows] = await pool.execute(
      `SELECT c.id, c.content, c.status, c.is_toxic, c.created_at, c.updated_at, u.username, p.title AS production_title, p.id AS production_id
       FROM comments c JOIN users u ON u.id = c.user_id JOIN productions p ON p.id = c.production_id ${where}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ items: rows, page, limit, total: countRows[0].total, pages: Math.max(1, Math.ceil(countRows[0].total / limit)) });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /comments/:id — xóa bình luận vi phạm
// ---------------------------------------------------------------------------
adminModerationRouter.delete(
  "/comments/:id",
  asyncHandler(async (req, res) => {
    const commentId = parsePositiveInt(req.params.id, "comment id");
    if (useMongo()) {
      const result = await (await mongoCollection("comments")).deleteOne({ id: commentId });
      if (!result.deletedCount) return res.status(404).json({ message: "Comment not found" });
      return res.status(204).end();
    }
    const [result] = await pool.execute("DELETE FROM comments WHERE id = ?", [commentId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Comment not found" });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// GET /ratings — danh sách đánh giá mới nhất
// ---------------------------------------------------------------------------
adminModerationRouter.get(
  "/ratings",
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination(req.query);
    if (useMongo()) {
      const ratings = await mongoCollection("ratings");
      const [total, rows] = await Promise.all([ratings.countDocuments(),
        ratings.find({}).sort({ updated_at: -1 }).skip(offset).limit(limit).toArray()]);
      const [users, productions] = await Promise.all([
        (await mongoCollection("users")).find({ id: { $in: rows.map((row) => row.user_id) } }).toArray(),
        (await mongoCollection("productions")).find({ id: { $in: rows.map((row) => row.production_id) } }).toArray(),
      ]);
      const usernames = new Map(users.map((user) => [user.id, user.username]));
      const titles = new Map(productions.map((production) => [production.id, production.title]));
      const items = rows.filter((row) => usernames.has(row.user_id) && titles.has(row.production_id))
        .map((row) => ({ user_id: row.user_id, production_id: row.production_id,
          rating: row.rating, review_title: row.review_title, review_content: row.review_content,
          is_toxic: row.is_toxic, created_at: row.created_at,
          username: usernames.get(row.user_id), production_title: titles.get(row.production_id) }));
      return res.json({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
    }
    const [countRows] = await pool.execute("SELECT COUNT(*) AS total FROM ratings");
    const [rows] = await pool.execute(
      `SELECT r.user_id, r.production_id, r.rating, r.review_title, r.review_content, r.is_toxic, r.created_at,
              u.username, p.title AS production_title
       FROM ratings r JOIN users u ON u.id = r.user_id JOIN productions p ON p.id = r.production_id
       ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    res.json({ items: rows, page, limit, total: countRows[0].total, pages: Math.max(1, Math.ceil(countRows[0].total / limit)) });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /ratings/:userId/:productionId — xóa đánh giá (khóa chính composite)
// ---------------------------------------------------------------------------
adminModerationRouter.delete(
  "/ratings/:userId/:productionId",
  asyncHandler(async (req, res) => {
    const userId = parsePositiveInt(req.params.userId, "user id");
    const productionId = parsePositiveInt(req.params.productionId, "production id");
    if (useMongo()) {
      const deleted = await withMongoTransaction(async (session) => {
        const ratings = await mongoCollection("ratings");
        const result = await ratings.deleteOne({ user_id: userId, production_id: productionId }, { session });
        if (!result.deletedCount) return false;
        const summary = await ratings.aggregate([
          { $match: { production_id: productionId } },
          { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } },
        ], { session }).next();
        await (await mongoCollection("productions")).updateOne({ id: productionId },
          { $set: { rating_avg: summary?.average || 0, rating_count: summary?.count || 0 } }, { session });
        return true;
      });
      if (!deleted) return res.status(404).json({ message: "Rating not found" });
      return res.status(204).end();
    }
    const [result] = await pool.execute("DELETE FROM ratings WHERE user_id = ? AND production_id = ?", [userId, productionId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Rating not found" });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// POST /notifications/broadcast — gửi thông báo tới toàn bộ người dùng
// ---------------------------------------------------------------------------
adminModerationRouter.post(
  "/notifications/broadcast",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 255) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
    if (!title || !message) return res.status(400).json({ message: "title và message là bắt buộc" });
    const redirectUrl = typeof body.redirectUrl === "string" && body.redirectUrl.trim() ? body.redirectUrl.trim().slice(0, 500) : null;
    if (useMongo()) {
      const users = await (await mongoCollection("users"))
        .find({ status: "active" }, { projection: { id: 1 } }).toArray();
      const notifications = await mongoCollection("notifications");
      for (const user of users) {
        const id = await nextNumericId("notifications");
        await notifications.insertOne({ _id: id, id, user_id: user.id, title, message,
          type: "system", entity_type: "user", entity_id: null, redirect_url: redirectUrl,
          is_read: 0, created_at: new Date(), read_at: null });
      }
      return res.status(201).json({ sent: users.length });
    }
    const [result] = await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, entity_type, redirect_url)
       SELECT id, ?, ?, 'system', 'user', ? FROM users WHERE status = 'active'`,
      [title, message, redirectUrl],
    );
    res.status(201).json({ sent: result.affectedRows });
  }),
);

// ---------------------------------------------------------------------------
// POST /search/reindex — đồng bộ lại index Elasticsearch (dùng service của Hai)
// ---------------------------------------------------------------------------
adminModerationRouter.post(
  "/search/reindex",
  asyncHandler(async (req, res) => {
    const count = await syncProductionIndex();
    res.json({ reindexed: count });
  }),
);
