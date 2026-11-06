import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { fromMongo, mongoCollection, nextNumericId, withMongoTransaction } from "../../core/database/mongo.js";
import { requireAuth, optionalAuth } from "../../core/middleware/business-auth.bridge.js";
import { rateLimit } from 'express-rate-limit';
import { asyncHandler, parsePositiveInt } from "../../core/utils/http.js";
import {
  detectToxicContent,
  TOXIC_COMMENT_WARNING,
} from "./toxic-comment.filter.js";

export const communityRouter = Router();
const useMongo = () => process.env.DATA_STORE === "mongodb";

const linkedProductions = async (collectionName, userId, dateField, extra = () => ({})) => {
  const links = await (await mongoCollection(collectionName)).find({ user_id: userId })
    .sort({ created_at: -1 }).toArray();
  const productions = await (await mongoCollection("productions"))
    .find({ id: { $in: links.map((link) => link.production_id) } }).toArray();
  const byId = new Map(productions.map((production) => [production.id, production]));
  return links.flatMap((link) => {
    const production = byId.get(link.production_id);
    return production ? [{ ...fromMongo(production), ...extra(link), [dateField]: link.created_at }] : [];
  });
};

const updateRatingSummary = async (productionId, session) => {
  const ratings = await mongoCollection("ratings");
  const summary = await ratings.aggregate([
    { $match: { production_id: productionId } },
    { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } },
  ], { session }).next();
  await (await mongoCollection("productions")).updateOne({ id: productionId },
    { $set: { rating_avg: summary?.average || 0, rating_count: summary?.count || 0 } }, { session });
};

const ensureProduction = async (id) => {
  if (useMongo()) {
    if (await (await mongoCollection("productions")).findOne({ id })) return;
    const error = new Error("Production not found"); error.status = 404; throw error;
  }
  const [rows] = await pool.execute("SELECT id FROM productions WHERE id=? LIMIT 1", [id]);
  if (!rows.length) { const error = new Error("Production not found"); error.status = 404; throw error; }
};

communityRouter.get("/favorites", requireAuth, asyncHandler(async (req, res) => {
  if (useMongo()) return res.json({ items: await linkedProductions("bookmarks", req.user.id,
    "favorited_at", (link) => ({ note: link.note })) });
  const [items] = await pool.execute(`SELECT p.*, b.note, b.created_at AS favorited_at FROM bookmarks b JOIN productions p ON p.id=b.production_id WHERE b.user_id=? ORDER BY b.created_at DESC`, [req.user.id]);
  res.json({ items });
}));

communityRouter.put("/favorites/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  await ensureProduction(productionId);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : null;
  if (useMongo()) {
    await (await mongoCollection("bookmarks")).updateOne(
      { user_id: req.user.id, production_id: productionId },
      { $set: { note }, $setOnInsert: { _id: { user_id: req.user.id, production_id: productionId },
        user_id: req.user.id, production_id: productionId, notify_new_episode: 0,
        created_at: new Date() } }, { upsert: true });
    return res.status(200).json({ productionId, isFavorite: true });
  }
  await pool.execute(`INSERT INTO bookmarks (user_id, production_id, note, notify_new_episode) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE note=VALUES(note)`, [req.user.id, productionId, note]);
  res.status(200).json({ productionId, isFavorite: true });
}));

communityRouter.delete("/favorites/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  if (useMongo()) {
    await (await mongoCollection("bookmarks")).deleteOne({ user_id: req.user.id, production_id: productionId });
    return res.status(204).end();
  }
  await pool.execute("DELETE FROM bookmarks WHERE user_id=? AND production_id=?", [req.user.id, productionId]);
  res.status(204).end();
}));

communityRouter.get("/interests", requireAuth, asyncHandler(async (req, res) => {
  if (useMongo()) return res.json({ items: await linkedProductions("production_interests",
    req.user.id, "followed_at") });
  const [items] = await pool.execute(`SELECT p.*, i.created_at AS followed_at FROM production_interests i JOIN productions p ON p.id=i.production_id WHERE i.user_id=? ORDER BY i.created_at DESC`, [req.user.id]);
  res.json({ items });
}));

communityRouter.put("/interests/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  await ensureProduction(productionId);
  if (useMongo()) {
    await (await mongoCollection("production_interests")).updateOne(
      { user_id: req.user.id, production_id: productionId },
      { $setOnInsert: { _id: { user_id: req.user.id, production_id: productionId },
        user_id: req.user.id, production_id: productionId, created_at: new Date() } },
      { upsert: true });
    return res.json({ productionId, interested: true });
  }
  await pool.execute(`INSERT INTO production_interests (user_id, production_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at=created_at`, [req.user.id, productionId]);
  res.json({ productionId, interested: true });
}));

communityRouter.delete("/interests/:productionId", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  if (useMongo()) {
    await (await mongoCollection("production_interests")).deleteOne({ user_id: req.user.id,
      production_id: productionId });
    return res.status(204).end();
  }
  await pool.execute("DELETE FROM production_interests WHERE user_id=? AND production_id=?", [req.user.id, productionId]);
  res.status(204).end();
}));

communityRouter.get("/productions/:productionId/ratings", asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  if (useMongo()) {
    const ratings = await (await mongoCollection("ratings"))
      .find({ production_id: productionId }).sort({ updated_at: -1 }).toArray();
    const users = await (await mongoCollection("users"))
      .find({ id: { $in: ratings.map((rating) => rating.user_id) } },
        { projection: { id: 1, username: 1, avatar_url: 1 } }).toArray();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items = ratings.flatMap((rating) => {
      const user = byId.get(rating.user_id);
      return user ? [{ rating: rating.rating, review_title: rating.review_title,
        review_content: rating.review_content, likes_count: rating.likes_count,
        is_edited: rating.is_edited, is_toxic: rating.is_toxic,
        created_at: rating.created_at, updated_at: rating.updated_at,
        user_id: user.id, username: user.username, avatar_url: user.avatar_url }] : [];
    });
    return res.json({ items });
  }
  const [items] = await pool.execute(`SELECT r.rating, r.review_title, r.review_content, r.likes_count, r.is_edited, r.is_toxic, r.created_at, r.updated_at, u.id AS user_id, u.username, u.avatar_url FROM ratings r JOIN users u ON u.id=r.user_id WHERE r.production_id=? ORDER BY r.updated_at DESC`, [productionId]);
  res.json({ items });
}));

communityRouter.put("/productions/:productionId/rating", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const body = req.body || {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "rating must be an integer from 1 to 5" });
  await ensureProduction(productionId);
  if (useMongo()) {
    const { isToxic } = await withMongoTransaction(async (session) => {
      const ratings = await mongoCollection("ratings");
      const filter = { user_id: req.user.id, production_id: productionId };
      const existing = await ratings.findOne(filter, { session });
      const title = body.title === undefined ? existing?.review_title ?? null
        : typeof body.title === "string" ? body.title.trim().slice(0, 200) || null : null;
      const review = body.review === undefined ? existing?.review_content ?? null
        : typeof body.review === "string" ? body.review.trim().slice(0, 5000) || null : null;
      const isToxic = detectToxicContent([title, review].filter(Boolean).join("\n")).isToxic;
      const now = new Date();
      await ratings.updateOne(filter, { $set: { rating, review_title: title,
        review_content: review, is_toxic: Number(isToxic), is_edited: existing ? 1 : 0,
        updated_at: now }, $setOnInsert: { _id: filter, ...filter,
        likes_count: 0, created_at: now } }, { upsert: true, session });
      await updateRatingSummary(productionId, session);
      return { title, review, isToxic };
    });
    return res.json({ productionId, rating, isToxic,
      warning: isToxic ? TOXIC_COMMENT_WARNING : null });
  }
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
  if (useMongo()) {
    await withMongoTransaction(async (session) => {
      await (await mongoCollection("ratings")).deleteOne({ user_id: req.user.id,
        production_id: productionId }, { session });
      await updateRatingSummary(productionId, session);
    });
    return res.status(204).end();
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM ratings WHERE user_id=? AND production_id=?", [req.user.id, productionId]);
    await connection.execute(`UPDATE productions p SET p.rating_avg=(SELECT COALESCE(AVG(r.rating),0) FROM ratings r WHERE r.production_id=p.id), p.rating_count=(SELECT COUNT(*) FROM ratings r WHERE r.production_id=p.id) WHERE p.id=?`, [productionId]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  res.status(204).end();
}));

communityRouter.get("/productions/:productionId/comments", optionalAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const paged = req.query.page !== undefined || req.query.limit !== undefined;
  const page = paged ? parsePositiveInt(req.query.page ?? '1', 'page') : 1;
  const limit = paged ? parsePositiveInt(req.query.limit ?? '20', 'limit') : null;
  if (paged && (page > 1000 || limit > 50)) return res.status(400).json({ message: 'Pagination exceeds limit' });
  const parentFilter = req.query.parentId === undefined ? undefined : req.query.parentId === 'root' ? null : parsePositiveInt(req.query.parentId, 'parent id');
  if (useMongo()) {
    if (paged) {
      const rows = await (await mongoCollection('comments')).aggregate([
        { $match: { production_id: productionId, status: 'active', ...(parentFilter !== undefined && { parent_id: parentFilter }) } },
        { $lookup: { from: 'users', localField: 'user_id', foreignField: 'id', as: 'author' } },
        { $unwind: '$author' },
        { $sort: { created_at: -1, id: -1 } },
        { $skip: (page - 1) * limit }, { $limit: limit + 1 },
        { $project: { _id: 0, id: 1, content: 1, parent_id: 1, likes_count: 1, score: 1, is_spoiler: 1, is_toxic: 1, created_at: 1, updated_at: 1, user_id: 1, username: '$author.username', avatar_url: '$author.avatar_url' } },
      ]).toArray();
      const visible = rows.slice(0, limit);
      const counts = await (await mongoCollection('comments')).aggregate([
        { $match: { production_id: productionId, status: 'active', parent_id: { $in: visible.map((item) => item.id) } } },
        { $group: { _id: '$parent_id', count: { $sum: 1 } } },
      ]).toArray();
      const countById = new Map(counts.map((item) => [item._id, item.count]));
      const votes = req.user ? await (await mongoCollection('movie_comment_votes')).find({ user_id: req.user.id, comment_id: { $in: visible.map((item) => item.id) } }).toArray() : [];
      const voteById = new Map(votes.map((vote) => [vote.comment_id, vote.value]));
      const voteCounts = await (await mongoCollection('movie_comment_votes')).aggregate([
        { $match: { comment_id: { $in: visible.map((item) => item.id) } } },
        { $group: { _id: '$comment_id', upvotes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } }, downvotes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } } } },
      ]).toArray();
      const countsById = new Map(voteCounts.map((entry) => [entry._id, entry]));
      return res.json({ items: visible.map((item) => ({ ...item, reply_count: countById.get(item.id) || 0, viewer_vote: voteById.get(item.id) || 0, upvotes: countsById.get(item.id)?.upvotes || 0, downvotes: countsById.get(item.id)?.downvotes || 0 })), page, hasMore: rows.length > limit });
    }
    const comments = await (await mongoCollection("comments"))
      .find({ production_id: productionId, status: "active" }).sort({ created_at: -1 }).toArray();
    const users = await (await mongoCollection("users"))
      .find({ id: { $in: comments.map((comment) => comment.user_id) } },
        { projection: { id: 1, username: 1, avatar_url: 1 } }).toArray();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items = comments.flatMap((comment) => {
      const user = byId.get(comment.user_id);
      return user ? [{ id: comment.id, content: comment.content, parent_id: comment.parent_id,
        likes_count: comment.likes_count, is_spoiler: comment.is_spoiler, is_toxic: comment.is_toxic,
        created_at: comment.created_at, updated_at: comment.updated_at,
        user_id: user.id, username: user.username, avatar_url: user.avatar_url }] : [];
    });
    return res.json({ items });
  }
  const sql = `SELECT c.id, c.content, c.parent_id, c.likes_count, c.is_toxic, c.created_at, c.updated_at, u.id AS user_id, u.username, u.avatar_url FROM comments c JOIN users u ON u.id=c.user_id WHERE c.production_id=? AND c.status='active' ORDER BY c.created_at DESC, c.id DESC`;
  const [items] = paged
    ? await pool.execute(`${sql} LIMIT ? OFFSET ?`, [productionId, limit + 1, (page - 1) * limit])
    : await pool.execute(sql, [productionId]);
  res.json(paged ? { items: items.slice(0, limit), page, hasMore: items.length > limit } : { items });
}));

communityRouter.post("/productions/:productionId/comments", requireAuth, asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.productionId, "production id");
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 3000) return res.status(400).json({ message: "content is required and must not exceed 3000 characters" });
  if (req.body?.isSpoiler !== undefined && typeof req.body.isSpoiler !== 'boolean') return res.status(400).json({ message: 'Invalid spoiler flag' });
  const parentId = req.body?.parentId == null ? null : parsePositiveInt(req.body.parentId, "parent id");
  await ensureProduction(productionId);
  let depth = 0;
  if (parentId) {
    if (useMongo()) {
      const comments = await mongoCollection('comments');
      let nextId = parentId;
      const visited = new Set();
      while (nextId != null) {
        if (visited.has(nextId) || depth >= 3) return res.status(400).json({ message: 'Invalid parent or maximum depth reached' });
        visited.add(nextId);
        const parent = await comments.findOne({ id: nextId, production_id: productionId, status: 'active' }, { projection: { parent_id: 1 } });
        if (!parent) return res.status(400).json({ message: 'Invalid parent comment' });
        depth += 1;
        nextId = parent.parent_id ?? null;
      }
    } else {
    const [parents] = await pool.execute("SELECT id FROM comments WHERE id=? AND production_id=? AND status='active'", [parentId, productionId]);
    if (!parents.length) return res.status(400).json({ message: "Invalid parent comment" });
    }
  }
  const { isToxic } = detectToxicContent(content);
  if (useMongo()) {
    const id = await nextNumericId("comments");
    const now = new Date();
    await (await mongoCollection("comments")).insertOne({ _id: id, id,
      user_id: req.user.id, production_id: productionId, content,
      parent_id: parentId, depth, likes_count: 0, score: 0, is_spoiler: req.body?.isSpoiler === true, is_toxic: Number(isToxic),
      status: "active", created_at: now, updated_at: now });
    return res.status(201).json({ id, content, parentId, isToxic,
      warning: isToxic ? TOXIC_COMMENT_WARNING : null });
  }
  const [result] = await pool.execute("INSERT INTO comments (user_id, production_id, content, parent_id, is_toxic) VALUES (?, ?, ?, ?, ?)", [req.user.id, productionId, content, parentId, isToxic ? 1 : 0]);
  res.status(201).json({
    id: result.insertId,
    content,
    parentId,
    isToxic,
    warning: isToxic ? TOXIC_COMMENT_WARNING : null,
  });
}));

communityRouter.put('/comments/:commentId/vote', requireAuth, asyncHandler(async (req, res) => {
  if (!useMongo()) return res.status(503).json({ message: 'MongoDB required' });
  const id = parsePositiveInt(req.params.commentId, 'comment id');
  const value = req.body?.value;
  if (![0, 1, -1].includes(value) || Object.keys(req.body).some((key) => key !== 'value')) return res.status(400).json({ message: 'Invalid vote' });
  const result = await withMongoTransaction(async (session) => {
    const comments = await mongoCollection('comments');
    const votes = await mongoCollection('movie_comment_votes');
    if (!await comments.findOne({ id, status: 'active' }, { session })) return null;
    const voteId = `${id}:${req.user.id}`;
    const previous = await votes.findOne({ _id: voteId }, { session });
    if (value === 0) await votes.deleteOne({ _id: voteId }, { session });
    else await votes.updateOne({ _id: voteId }, { $set: { value }, $setOnInsert: { comment_id: id, user_id: req.user.id } }, { upsert: true, session });
    const updated = await comments.findOneAndUpdate({ id, status: 'active' }, { $inc: { score: value - (previous?.value || 0) } }, { session, returnDocument: 'after' });
    if (!updated) return null;
    const upvotes = await votes.countDocuments({ comment_id: id, value: 1 }, { session });
    const downvotes = await votes.countDocuments({ comment_id: id, value: -1 }, { session });
    return { score: updated.score, value, upvotes, downvotes };
  });
  return result ? res.json(result) : res.status(404).json({ message: 'Comment not found' });
}));

const reportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: 'draft-7', legacyHeaders: false });
communityRouter.post('/comments/:commentId/reports', requireAuth, reportLimiter, asyncHandler(async (req, res) => {
  if (!useMongo()) return res.status(503).json({ message: 'MongoDB required' });
  const id = parsePositiveInt(req.params.commentId, 'comment id');
  const { reason, description = '' } = req.body || {};
  if (!['spam', 'harassment', 'spoiler', 'other'].includes(reason) || typeof description !== 'string' || description.length > 1000) return res.status(400).json({ message: 'Invalid report' });
  if (!await (await mongoCollection('comments')).findOne({ id, status: 'active' })) return res.status(404).json({ message: 'Comment not found' });
  try {
    await (await mongoCollection('community_reports')).insertOne({ _id: `movie-comment:${id}:${req.user.id}`, reporter_id: req.user.id, target_type: 'comment', target_id: id, comment_source: 'movie', reason, description: description.trim(), status: 'open', created_at: new Date() });
  } catch (error) { if (error.code === 11000) return res.status(409).json({ message: 'Bạn đã báo cáo bình luận này.' }); throw error; }
  return res.status(201).json({ message: 'Đã gửi báo cáo.' });
}));

communityRouter.patch("/comments/:commentId", requireAuth, asyncHandler(async (req, res) => {
  const commentId = parsePositiveInt(req.params.commentId, "comment id");
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 3000) return res.status(400).json({ message: "content is required and must not exceed 3000 characters" });
  if (req.body?.isSpoiler !== undefined && typeof req.body.isSpoiler !== 'boolean') return res.status(400).json({ message: 'Invalid spoiler flag' });
  const { isToxic } = detectToxicContent(content);
  if (useMongo()) {
    const result = await (await mongoCollection("comments")).updateOne({ id: commentId,
      user_id: req.user.id, status: "active" }, { $set: { content,
      is_toxic: Number(isToxic), ...(req.body?.isSpoiler !== undefined && { is_spoiler: req.body.isSpoiler }), updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: "Comment not found" });
    return res.json({ id: commentId, content, isToxic,
      warning: isToxic ? TOXIC_COMMENT_WARNING : null });
  }
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
  const canModerate = req.user.role === "admin";
  if (useMongo()) {
    const result = await (await mongoCollection("comments")).updateOne({ id: commentId,
      ...(!canModerate && { user_id: req.user.id }), status: "active" }, { $set: { status: "deleted",
      content: "[Đã xóa]", updated_at: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: "Comment not found" });
    return res.status(204).end();
  }
  const [result] = canModerate
    ? await pool.execute("UPDATE comments SET status='deleted', content='[Đã xóa]' WHERE id=? AND status='active'", [commentId])
    : await pool.execute("UPDATE comments SET status='deleted', content='[Đã xóa]' WHERE id=? AND user_id=? AND status='active'", [commentId, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Comment not found" });
  res.status(204).end();
}));

communityRouter.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  if (useMongo()) {
    const rows = await (await mongoCollection("notifications"))
      .find({ user_id: req.user.id }).sort({ created_at: -1 }).limit(100).toArray();
    const items = rows.map((row) => ({ id: row.id, title: row.title, message: row.message,
      type: row.type, entity_type: row.entity_type, entity_id: row.entity_id,
      redirect_url: row.redirect_url, is_read: row.is_read,
      created_at: row.created_at, read_at: row.read_at }));
    return res.json({ items, unread: items.filter((item) => !item.is_read).length });
  }
  const [items] = await pool.execute("SELECT id, title, message, type, entity_type, entity_id, redirect_url, is_read, created_at, read_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100", [req.user.id]);
  res.json({ items, unread: items.filter((item) => !item.is_read).length });
}));

communityRouter.patch("/notifications/:notificationId/read", requireAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.notificationId, "notification id");
  if (useMongo()) {
    const result = await (await mongoCollection("notifications")).updateOne(
      { id, user_id: req.user.id }, [{ $set: { is_read: 1,
        read_at: { $ifNull: ["$read_at", new Date()] } } }]);
    if (!result.matchedCount) return res.status(404).json({ message: "Notification not found" });
    return res.status(204).end();
  }
  const [result] = await pool.execute("UPDATE notifications SET is_read=1, read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id=? AND user_id=?", [id, req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Notification not found" });
  res.status(204).end();
}));

communityRouter.patch("/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
  if (useMongo()) {
    await (await mongoCollection("notifications")).updateMany(
      { user_id: req.user.id, is_read: 0 }, [{ $set: { is_read: 1,
        read_at: { $ifNull: ["$read_at", new Date()] } } }]);
    return res.status(204).end();
  }
  await pool.execute("UPDATE notifications SET is_read=1, read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id=? AND is_read=0", [req.user.id]);
  res.status(204).end();
}));
