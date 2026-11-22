import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { mongoCollection, withMongoTransaction } from '../../core/database/mongo.js';
import { requireAuth, requireRole } from '../../core/middleware/auth.middleware.js';
import { asyncHandler } from '../../core/utils/http.js';
import { createNotification, emitStoredNotification, ensureNotificationIndexes } from './notification.service.js';
import { resolveModerationReport, submitModerationReport } from './moderation.service.js';

export const moderationRouter = Router();
export const moderationAdminRouter = Router();
const mongoOnly = (_req, res, next) => process.env.DATA_STORE === 'mongodb' ? next() : res.status(503).json({ message: 'MongoDB required' });
const pageOf = (value) => Math.max(1, Math.min(1000, Number.parseInt(value || '1', 10) || 1));
moderationRouter.use(mongoOnly, requireAuth);
moderationAdminRouter.use(mongoOnly, requireAuth, requireRole('admin', 'moderator'));
const reportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

moderationRouter.post('/reports', reportLimiter, asyncHandler(async (req, res) => {
  res.status(201).json(await submitModerationReport(req.user.id, req.body));
}));

moderationAdminRouter.get('/reports', asyncHandler(async (req, res) => {
  const status = String(req.query.status || 'open');
  if (!['open', 'resolved', 'dismissed', 'all'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const page = pageOf(req.query.page), limit = 20, filter = status === 'all' ? {} : { status };
  const reports = await mongoCollection('community_reports');
  const [items, total, counts, flagsOpen] = await Promise.all([
    reports.find(filter, { projection: { reporter_id: 1, target_type: 1, target_id: 1, post_id: 1, production_id: 1, comment_source: 1, review_source: 1, review_author_id: 1, target_excerpt: 1, reason: 1, description: 1, status: 1, action: 1, review_reason: 1, created_at: 1, reviewed_at: 1 } }).sort({ created_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    reports.countDocuments(filter),
    reports.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
    req.user.role === 'admin' ? (await mongoCollection('point_review_flags')).countDocuments({ status: 'open' }) : 0,
  ]);
  const commentReports = items.filter((item) => item.target_type === 'comment');
  const [communityComments, movieComments] = await Promise.all([
    commentReports.some((item) => item.comment_source !== 'movie') ? (await mongoCollection('community_post_comments')).find({ _id: { $in: commentReports.filter((item) => item.comment_source !== 'movie').map((item) => item.target_id) } }, { projection: { _id: 1, post_id: 1, content: 1 } }).toArray() : [],
    commentReports.some((item) => item.comment_source === 'movie') ? (await mongoCollection('comments')).find({ _id: { $in: commentReports.filter((item) => item.comment_source === 'movie').map((item) => item.target_id) } }, { projection: { _id: 1, production_id: 1, content: 1 } }).toArray() : [],
  ]);
  const byComment = new Map([...communityComments, ...movieComments].map((item) => [item._id, item]));
  res.json({ items: items.map((item) => {
    const comment = item.target_type === 'comment' ? byComment.get(item.target_id) : null;
    return { ...item, ...(comment && { post_id: item.post_id || comment.post_id, production_id: comment.production_id, target_excerpt: item.target_excerpt || comment.content?.slice(0, 500) }) };
  }), total, page, hasMore: page * limit < total, stats: { ...Object.fromEntries(counts.map((item) => [item._id, item.count])), flagsOpen } });
}));

moderationAdminRouter.post('/reports/:id/resolve', asyncHandler(async (req, res) => {
  const result = await resolveModerationReport(req.params.id, req.user.id, req.body, req.user.role);
  if (!result) return res.status(409).json({ message: 'Report already reviewed' });
  res.json(result);
}));

moderationAdminRouter.get('/flags', requireRole('admin'), asyncHandler(async (req, res) => {
  const status = String(req.query.status || 'open');
  if (!['open', 'reviewed', 'all'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const page = pageOf(req.query.page), limit = 20, filter = status === 'all' ? {} : { status };
  const flags = await mongoCollection('point_review_flags');
  const [items, total] = await Promise.all([flags.find(filter, { projection: { _id: 1, userId: 1, actorId: 1, day: 1, reason: 1, status: 1, createdAt: 1 } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(), flags.countDocuments(filter)]);
  res.json({ items, total, page, hasMore: page * limit < total });
}));

moderationAdminRouter.post('/flags/:id/review', requireRole('admin'), asyncHandler(async (req, res) => {
  const { decision, reason } = req.body || {};
  if (!['clear', 'confirm'].includes(decision) || typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500) return res.status(400).json({ message: 'Decision and reason are required' });
  await ensureNotificationIndexes();
  const result = await withMongoTransaction(async (session) => {
    const flags = await mongoCollection('point_review_flags');
    const flag = await flags.findOne({ _id: req.params.id, status: 'open' }, { session });
    if (!flag) return null;
    if (decision === 'confirm') {
      const changed = await (await mongoCollection('users')).updateOne({ id: flag.userId, status: 'active', role: 'user' }, { $set: { fraud_confirmed: true, fraud_reviewed_at: new Date(), fraud_reviewed_by: req.user.id } }, { session });
      if (!changed.matchedCount) throw Object.assign(new Error('User is not eligible for fraud review'), { status: 409 });
    }
    await flags.updateOne({ _id: flag._id, status: 'open' }, { $set: { status: 'reviewed', decision, reviewReason: reason.trim(), reviewedBy: req.user.id, reviewedAt: new Date() } }, { session });
    await (await mongoCollection('moderation_audit')).insertOne({ flagId: flag._id, targetUserId: flag.userId, actorId: req.user.id, action: `flag_${decision}`, reason: reason.trim(), createdAt: new Date() }, { session });
    const notification = decision === 'confirm' ? await createNotification({ recipientId: flag.userId, type: 'system', title: 'Kết quả kiểm tra điểm', message: `Tài khoản đã bị xác nhận có tương tác điểm không hợp lệ. Lý do: ${reason.trim()}`, entityType: 'point_review_flag', entityId: flag.userId, redirectUrl: '/notifications', deduplicationKey: `flag-review:${flag._id}`, session }) : null;
    return { status: 'reviewed', notification };
  });
  if (!result) return res.status(409).json({ message: 'Flag already reviewed' });
  emitStoredNotification(result.notification);
  res.json({ status: result.status });
}));
