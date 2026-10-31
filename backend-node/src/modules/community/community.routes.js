import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { requireAuth } from "../../core/middleware/business-auth.bridge.js";
import { asyncHandler, parsePositiveInt } from "../../core/utils/http.js";
import {
  detectToxicContent,
  TOXIC_COMMENT_WARNING,
} from "./toxic-comment.filter.js";

export const communityRouter = Router();

const ensureProduction = async (id) => {
  const [rows] = await pool.execute("SELECT id FROM productions WHERE id=? LIMIT 1", [id]);
  if (!rows.length) { const error = new Error("Production not found"); error.status = 404; throw error; }
};

communityRouter.get("/favorites", requireAuth, asyncHandler(async (req, res) => {
  const [items] = await pool.execute(`SELECT p.*, b.note, b.created_at AS favorited_at FROM bookmarks b JOIN productions p ON p.id=b.production_id WHERE b.user_id=? ORDER BY b.created_at DESC`, [req.user.id]);
  res.json({ items });
}));

communityRouter.put("/favorites/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  await ensureProduction(productionId);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : null;
  await pool.execute(`INSERT INTO bookmarks (user_id, production_id, note, notify_new_episode) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE note=VALUES(note)`, [req.user.id, productionId, note]);
  res.status(200).json({ productionId, isFavorite: true });
}));

communityRouter.delete("/favorites/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  await pool.execute("DELETE FROM bookmarks WHERE user_id=? AND production_id=?", [req.user.id, productionId]);
  res.status(204).end();
}));

communityRouter.get("/interests", requireAuth, asyncHandler(async (req, res) => {
  const [items] = await pool.execute(`SELECT p.*, i.created_at AS followed_at FROM production_interests i JOIN productions p ON p.id=i.production_id WHERE i.user_id=? ORDER BY i.created_at DESC`, [req.user.id]);
  res.json({ items });
}));

communityRouter.put("/interests/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  await ensureProduction(productionId);
  await pool.execute(`INSERT INTO production_interests (user_id, production_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at=created_at`, [req.user.id, productionId]);
  res.json({ productionId, interested: true });
}));

communityRouter.delete("/interests/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  await pool.execute("DELETE FROM production_interests WHERE user_id=? AND production_id=?", [req.user.id, productionId]);
  res.status(204).end();
}));

communityRouter.get("/productions/:productionId/ratings", asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const [items] = await pool.execute(`SELECT r.rating, r.review_title, r.review_content, r.likes_count, r.is_edited, r.is_toxic, r.created_at, r.updated_at, u.id AS user_id, u.username, u.avatar_url FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.production_id=? ORDER BY r.updated_at DESC`, [productionId]);
  res.json({ items });
}));

communityRouter.put("/productions/:productionId/rating", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const body = req.body || {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "rating must be an integer from 1 to 5" });
  await ensureProduction(productionId);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      "SELECT review_title, review_content FROM ratings WHERE user_id=? AND production_id=? LIMIT 1",
      [req.user.id, productionId],
    );
    const title = body.title === undefined
      ? existing[0]?.review_title ?? null
      : typeof body.title === "string" ? body.title.trim().slice(0, 200) || null : null;
    const review = body.review === undefined
      ? existing[0]?.review_content ?? null
      : typeof body.review === "string" ? body.review.trim().slice(0, 5000) || null : null;
    const { isToxic } = detectToxicContent([title, review].filter(Boolean).join("\n"));
    await connection.execute(
      `INSERT INTO ratings (user_id, production_id, rating, review_title, review_content, is_toxic)
       VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating=VALUES(rating),
       review_title=VALUES(review_title), review_content=VALUES(review_content),
       is_toxic=VALUES(is_toxic), is_edited=1`,
      [req.user.id, productionId, rating, title, review, isToxic ? 1 : 0],
    );
    await connection.execute(`UPDATE productions p SET p.rating_avg=(SELECT COALESCE(AVG(r.rating),0) FROM ratings r WHERE r.production_id=p.id), p.rating_count=(SELECT COUNT(*) FROM ratings r WHERE r.production_id=p.id) WHERE p.id=?`, [productionId]);
    await connection.commit();
    res.json({
      productionId,
      rating,
      isToxic,
      warning: isToxic ? TOXIC_COMMENT_WARNING : null,
    });
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}));

communityRouter.delete("/productions/:productionId/rating", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM ratings WHERE user_id=? AND production_id=?", [req.user.id, productionId]);
    await connection.execute(`UPDATE productions p SET p.rating_avg=(SELECT COALESCE(AVG(r.rating),0) FROM ratings r WHERE r.production_id=p.id), p.rating_count=(SELECT COUNT(*) FROM ratings r WHERE r.production_id=p.id) WHERE p.id=?`, [productionId]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  res.status(204).end();
}));

communityRouter.get("/productions/:productionId/comments", asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const [items] = await pool.execute(`SELECT c.id, c.content, c.parent_id, c.likes_count, c.is_toxic, c.created_at, c.updated_at, u.id AS user_id, u.username, u.avatar_url FROM comments c JOIN users u ON u.id=c.user_id WHERE c.production_id=? AND c.status='active' ORDER BY c.created_at DESC`, [productionId]);
  res.json({ items });
}));

communityRouter.post("/productions/:productionId/comments", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 3000) return res.status(400).json({ message: "content is required and must not exceed 3000 characters" });
  const parentId = req.body?.parentId == null ? null : parsePositiveInt(req.body.parentId, "parent id");
  await ensureProduction(productionId);
  if (parentId) {
    const [parents] = await pool.execute("SELECT id FROM comments WHERE id=? AND production_id=? AND status='active'", [parentId, productionId]);
    if (!parents.length) return res.status(400).json({ message: "Invalid parent comment" });
  }
  const { isToxic } = detectToxicContent(content);
  const [result] = await pool.execute("INSERT INTO comments (user_id, production_id, content, parent_id, is_toxic) VALUES (?, ?, ?, ?, ?)", [req.user.id, productionId, content, parentId, isToxic ? 1 : 0]);
  res.status(201).json({
    id: result.insertId,
    content,
    parentId,
    isToxic,
    warning: isToxic ? TOXIC_COMMENT_WARNING : null,
  });
}));

communityRouter.patch("/comments/:commentId", requireAuth, asyncHandler(async (req, res) => {
  const commentId = parsePositiveInt(req.params.commentId, "comment id");
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 3000) return res.status(400).json({ message: "content is required and must not exceed 3000 characters" });
  const { isToxic } = detectToxicContent(content);
  const [result] = await pool.execute("UPDATE comments SET content=?, is_toxic=? WHERE id=? AND user_id=? AND status='active'", [content, isToxic ? 1 : 0, commentId, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Comment not found" });
  res.json({
    id: commentId,
    content,
    isToxic,
    warning: isToxic ? TOXIC_COMMENT_WARNING : null,
  });
}));

communityRouter.delete("/comments/:commentId", requireAuth, asyncHandler(async (req, res) => {
  const commentId = parsePositiveInt(req.params.commentId, "comment id");
  const [result] = await pool.execute("UPDATE comments SET status='deleted', content='[Đã xóa]' WHERE id=? AND user_id=? AND status='active'", [commentId, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Comment not found" });
  res.status(204).end();
}));

communityRouter.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  const [items] = await pool.execute("SELECT id, title, message, type, entity_type, entity_id, redirect_url, is_read, created_at, read_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100", [req.user.id]);
  res.json({ items, unread: items.filter((item) => !item.is_read).length });
}));

communityRouter.patch("/notifications/:notificationId/read", requireAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.notificationId, "notification id");
  const [result] = await pool.execute("UPDATE notifications SET is_read=1, read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id=? AND user_id=?", [id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Notification not found" });
  res.status(204).end();
}));

communityRouter.patch("/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
  await pool.execute("UPDATE notifications SET is_read=1, read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id=? AND is_read=0", [req.user.id]);
  res.status(204).end();
}));
