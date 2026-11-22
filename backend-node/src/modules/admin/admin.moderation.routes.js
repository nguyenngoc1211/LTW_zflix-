import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { mongoCollection, nextNumericId, withMongoTransaction } from "../../core/database/mongo.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";
import { syncProductionIndex } from "../discovery/search.service.js";
import { ensurePointIndexes, reversePoints } from '../community/points.service.js';
import { cleanupCommentImages } from '../community/comment-media.js';

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

// Search comments within one post or movie without exposing private post content.
adminModerationRouter.get('/content/comments', asyncHandler(async (req, res) => {
  if (!useMongo()) return res.status(503).json({ message: 'MongoDB required' });
  const source = req.query.source;
  if (!['post', 'movie'].includes(source)) return res.status(400).json({ message: 'Invalid source' });
  const sourceId = parsePositiveInt(req.query.sourceId, 'source id');
  const page = parsePositiveInt(req.query.page || 1, 'page');
  if (page > 1000) return res.status(400).json({ message: 'Pagination exceeds limit' });
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  if (!search) return res.status(400).json({ message: 'Search is required' });
  const collection = await mongoCollection(source === 'post' ? 'community_post_comments' : 'comments');
  const parent = await (await mongoCollection(source === 'post' ? 'community_posts' : 'productions')).findOne(source === 'post' ? { _id: sourceId, status: 'active' } : { id: sourceId }, { projection: { _id: 1 } });
  if (!parent) return res.status(404).json({ message: 'Content not found' });
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = { [source === 'post' ? 'post_id' : 'production_id']: sourceId, status: 'active', content: { $regex: escaped, $options: 'i' } };
  const [total, rows] = await Promise.all([collection.countDocuments(filter), collection.find(filter, { projection: { _id: 1, id: 1, author_id: 1, user_id: 1, parent_id: 1, content: 1, created_at: 1, upvotes: 1, downvotes: 1, is_toxic: 1 } }).sort({ created_at: -1, _id: -1 }).skip((page - 1) * 20).limit(20).toArray()]);
  const counts = await collection.aggregate([{ $match: { [source === 'post' ? 'post_id' : 'production_id']: sourceId, parent_id: { $in: rows.map((row) => row.id) }, status: 'active' } }, { $group: { _id: '$parent_id', total: { $sum: 1 } } }]).toArray();
  const countById = new Map(counts.map((item) => [item._id, item.total]));
  const votes = await (await mongoCollection(source === 'post' ? 'community_comment_votes' : 'movie_comment_votes')).aggregate([{ $match: { comment_id: { $in: rows.map((row) => row.id) } } }, { $group: { _id: '$comment_id', upvotes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } }, downvotes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } } } }]).toArray();
  const votesById = new Map(votes.map((item) => [item._id, item]));
  const authors = await (await mongoCollection('users')).find({ id: { $in: rows.map((row) => row.author_id ?? row.user_id) } }, { projection: { _id: 0, id: 1, username: 1, avatar_url: 1 } }).toArray();
  const byId = new Map(authors.map((author) => [author.id, author]));
  res.json({ items: rows.map((row) => ({ id: row.id, parent_id: row.parent_id ?? null, content: row.content, created_at: row.created_at, is_toxic: row.is_toxic, upvotes: votesById.get(row.id)?.upvotes || 0, downvotes: votesById.get(row.id)?.downvotes || 0, reply_count: countById.get(row.id) || 0, author: byId.get(row.author_id ?? row.user_id) || null, status: 'active' })), total, page, hasMore: page * 20 < total });
}));

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
      await ensurePointIndexes();
      const result = await withMongoTransaction(async (session) => {
        const collection = await mongoCollection('comments');
        const existing = await collection.findOne({ id: commentId }, { session, projection: { images: 1 } });
        const removed = await collection.deleteOne({ id: commentId }, { session });
        if (removed.deletedCount) {
          await reversePoints({ sourceType: 'movie_comment', sourceId: commentId, session });
          await reversePoints({ sourceType: 'movie_comment_vote', sourceId: commentId, session });
          await (await mongoCollection('moderation_audit')).insertOne({ actorId: req.user.id, targetType: 'movie_comment', targetId: commentId, action: 'delete', source: 'admin_content', createdAt: new Date() }, { session });
        }
        return { deletedCount: removed.deletedCount, images: existing?.images || [] };
      });
      if (!result.deletedCount) return res.status(404).json({ message: "Comment not found" });
      await cleanupCommentImages(result.images);
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
    const productionId = req.query.productionId === undefined ? null : parsePositiveInt(req.query.productionId, 'production id');
    if (useMongo()) {
      const ratings = await mongoCollection("ratings");
      const filter = productionId ? { production_id: productionId } : {};
      const [total, rows] = await Promise.all([ratings.countDocuments(filter),
        ratings.find(filter).sort({ updated_at: -1 }).skip(offset).limit(limit).toArray()]);
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
    const [countRows] = await pool.execute(productionId ? "SELECT COUNT(*) AS total FROM ratings WHERE production_id = ?" : "SELECT COUNT(*) AS total FROM ratings", productionId ? [productionId] : []);
    const [rows] = await pool.execute(
      `SELECT r.user_id, r.production_id, r.rating, r.review_title, r.review_content, r.is_toxic, r.created_at,
              u.username, p.title AS production_title
       FROM ratings r JOIN users u ON u.id = r.user_id JOIN productions p ON p.id = r.production_id
       ${productionId ? 'WHERE r.production_id = ?' : ''}
       ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`,
      productionId ? [productionId, limit, offset] : [limit, offset],
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
          { $match: { production_id: productionId, moderation_hidden: { $ne: true } } },
          { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } },
        ], { session }).next();
        await (await mongoCollection("productions")).updateOne({ id: productionId },
          { $set: { rating_avg: summary?.average || 0, rating_count: summary?.count || 0 } }, { session });
        await (await mongoCollection('moderation_audit')).insertOne({ actorId: req.user.id, targetType: 'rating', targetId: productionId, targetUserId: userId, action: 'delete', source: 'admin_content', createdAt: new Date() }, { session });
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
  (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin required' }),
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
  (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin required' }),
  asyncHandler(async (req, res) => {
    const count = await syncProductionIndex();
    res.json({ reindexed: count });
  }),
);
