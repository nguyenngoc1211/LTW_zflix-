import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";
import { syncProductionIndex } from "../discovery/search.service.js";

export const adminModerationRouter = Router();

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
