import { Router } from 'express';
import { mongoCollection, withMongoTransaction } from '../../core/database/mongo.js';
import { requireAuth, optionalAuth } from '../../core/middleware/auth.middleware.js';
import { asyncHandler, parsePositiveInt } from '../../core/utils/http.js';
import { RULES, monthKey, monthBounds, ensurePointIndexes, leaderboard, closeMonth, approveReward, pointConfig } from './points.service.js';
import { resolveModerationReport } from './moderation.service.js';

export const pointsRouter = Router();
export const pointsAdminRouter = Router();
const guardStore = (req, res, next) => process.env.DATA_STORE === 'mongodb' ? next() : res.status(503).json({ message: 'Points require MongoDB' });
const admin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin required' });
const pageOf = (req) => Math.min(parsePositiveInt(req.query.page || 1), 1000);
const limitOf = (req) => Math.min(parsePositiveInt(req.query.limit || 20), 100);
const txFields = { _id: 0, userId: 1, type: 1, sourceType: 1, sourceId: 1, points: 1, month: 1, createdAt: 1, reason: 1 };
pointsRouter.use(guardStore);
pointsAdminRouter.use(guardStore, requireAuth, admin);

pointsRouter.get('/config', asyncHandler(async (_req, res) => res.json({ ...await pointConfig(), timezone: 'Asia/Ho_Chi_Minh' })));
pointsRouter.get('/months', asyncHandler(async (_req, res) => {
  const months = await (await mongoCollection('monthly_leaderboards')).find({}, { projection: { _id: 0, month: 1, closedAt: 1 } }).sort({ month: -1 }).limit(36).toArray();
  res.json({ months });
}));
pointsRouter.get('/leaderboard', optionalAuth, asyncHandler(async (req, res) => {
  const month = String(req.query.month || monthKey()); monthBounds(month);
  const board = await leaderboard(month, req.user?.id);
  res.json({ month, closed: board.closed, top: board.top, me: board.me, rewards: board.rewards || (await pointConfig()).rewards, closesAt: monthBounds(month)[1] });
}));
pointsRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  await ensurePointIndexes();
  const tx = await mongoCollection('point_transactions');
  const month = monthKey();
  const [totals, board, badges] = await Promise.all([
    tx.aggregate([{ $match: { userId: req.user.id } }, { $group: { _id: null, total: { $sum: '$points' }, monthly: { $sum: { $cond: [{ $eq: ['$month', month] }, '$points', 0] } } } }]).next(),
    leaderboard(month, req.user.id),
    (await mongoCollection('monthly_vip_rewards')).find({ userId: req.user.id, status: 'granted' }, { projection: { _id: 0, month: 1, rank: 1, kind: 1, days: 1, grantedAt: 1, vipExpiresAt: 1 } }).sort({ month: -1 }).limit(36).toArray(),
  ]);
  res.json({ totalPoints: totals?.total || 0, monthlyPoints: totals?.monthly || 0, rank: board.me?.rank || null, badges });
}));
pointsRouter.get('/me/history', requireAuth, asyncHandler(async (req, res) => {
  const page = pageOf(req), limit = limitOf(req), tx = await mongoCollection('point_transactions');
  const filter = { userId: req.user.id };
  const [items, total] = await Promise.all([tx.find(filter, { projection: txFields }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(), tx.countDocuments(filter)]);
  res.json({ items, total, page, hasMore: page * limit < total });
}));

pointsAdminRouter.get('/transactions', asyncHandler(async (req, res) => {
  const page = pageOf(req), limit = limitOf(req), filter = {};
  if (req.query.userId !== undefined) filter.userId = parsePositiveInt(req.query.userId);
  const tx = await mongoCollection('point_transactions');
  const [items, total] = await Promise.all([tx.find(filter, { projection: { ...txFields, actorId: 1, idempotencyKey: 1 } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(), tx.countDocuments(filter)]);
  res.json({ items, total, page, hasMore: page * limit < total });
}));
pointsAdminRouter.put('/config', asyncHandler(async (req, res) => {
  const { rules, rewards, reason } = req.body || {};
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500 || !rules || !rewards || Object.keys(rules).sort().join(',') !== Object.keys(RULES).sort().join(',') || !Array.isArray(rewards) || rewards.length !== 3 || rewards.some((item, index) => item.rank !== index + 1 || !Number.isSafeInteger(item.days) || item.days < 1 || item.days > 365 || !Number.isSafeInteger(item.min) || item.min < 0 || item.min > 100000) || Object.values(rules).some((item) => !Number.isSafeInteger(item.points) || item.points < 0 || item.points > 100 || (item.daily !== null && (!Number.isSafeInteger(item.daily) || item.daily < 1 || item.daily > 100)))) return res.status(400).json({ message: 'Invalid configuration or reason' });
  const normalized = Object.fromEntries(Object.keys(RULES).map((key) => [key, { points: rules[key].points, daily: rules[key].daily }]));
  const normalizedRewards = rewards.map(({ rank, days, min }) => ({ rank, days, min }));
  await withMongoTransaction(async (session) => {
    await (await mongoCollection('point_settings')).updateOne({ _id: 'current' }, { $set: { rules: normalized, rewards: normalizedRewards, updatedAt: new Date(), updatedBy: req.user.id } }, { upsert: true, session });
    await (await mongoCollection('point_admin_audit')).insertOne({ action: 'config_update', actorId: req.user.id, reason: reason.trim(), rules: normalized, rewards: normalizedRewards, createdAt: new Date() }, { session });
  });
  res.json({ rules: normalized, rewards: normalizedRewards, autoApprove: false });
}));
pointsAdminRouter.post('/adjustments', asyncHandler(async (req, res) => {
  const userId = parsePositiveInt(req.body?.userId), points = req.body?.points, reason = req.body?.reason?.trim(), requestId = req.body?.requestId;
  if (!Number.isSafeInteger(points) || points === 0 || Math.abs(points) > 1000 || !reason || reason.length < 10 || reason.length > 500 || typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(requestId)) return res.status(400).json({ message: 'User, points, reason and request ID are required' });
  await ensurePointIndexes();
  const key = `admin:${req.user.id}:${requestId}`;
  const existing = await (await mongoCollection('point_transactions')).findOne({ _id: key });
  if (existing) return res.json({ ...existing, _id: undefined, idempotencyKey: undefined, idempotent: true });
  let record;
  try { record = await withMongoTransaction(async (session) => {
    if (!await (await mongoCollection('users')).findOne({ id: userId }, { session, projection: { id: 1 } })) return null;
    const at = new Date();
    const item = { _id: key, idempotencyKey: key, userId, type: 'admin_adjustment', sourceType: 'admin', sourceId: userId, actorId: req.user.id, points, reason, month: monthKey(at), createdAt: at };
    await (await mongoCollection('point_transactions')).insertOne(item, { session });
    await (await mongoCollection('point_admin_audit')).insertOne({ userId, actorId: req.user.id, points, reason, transactionKey: key, createdAt: at }, { session });
    return item;
  }); } catch (error) {
    if (error.code !== 11000) throw error;
    const replay = await (await mongoCollection('point_transactions')).findOne({ _id: key });
    if (!replay) throw error;
    return res.json({ ...replay, _id: undefined, idempotencyKey: undefined, idempotent: true });
  }
  if (!record) return res.status(404).json({ message: 'User not found' });
  res.status(201).json({ ...record, _id: undefined, idempotencyKey: undefined });
}));
pointsAdminRouter.get('/months/:month', asyncHandler(async (req, res) => {
  monthBounds(req.params.month);
  const [board, rewards] = await Promise.all([leaderboard(req.params.month), (await mongoCollection('monthly_vip_rewards')).find({ month: req.params.month }, { projection: { _id: 0 } }).sort({ rank: 1 }).toArray()]);
  res.json({ month: req.params.month, closed: board.closed, rows: board.closed ? (await (await mongoCollection('monthly_leaderboards')).findOne({ month: req.params.month })).rows : board.rows, rewards });
}));
pointsAdminRouter.post('/months/:month/close', asyncHandler(async (req, res) => {
  const result = await closeMonth(req.params.month);
  res.json({ month: result.month, closed: result.closed, count: result.top.length });
}));
pointsAdminRouter.post('/months/:month/rewards/:userId', asyncHandler(async (req, res) => {
  monthBounds(req.params.month);
  const userId = parsePositiveInt(req.params.userId), { decision, reason } = req.body || {};
  if (!['approve', 'exclude'].includes(decision) || typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500) return res.status(400).json({ message: 'Decision and reason are required' });
  const result = await approveReward(req.params.month, userId, req.user.id, decision, reason.trim());
  if (!result) return res.status(409).json({ message: 'Reward has already been processed' });
  res.json({ status: result.status });
}));
pointsAdminRouter.get('/reports', asyncHandler(async (req, res) => {
  const page = pageOf(req), limit = limitOf(req);
  const reports = await mongoCollection('community_reports');
  const [items, total] = await Promise.all([reports.find({ status: 'open' }, { projection: { _id: 1, reporter_id: 1, target_type: 1, target_id: 1, reason: 1, description: 1, created_at: 1 } }).sort({ created_at: 1 }).skip((page - 1) * limit).limit(limit).toArray(), reports.countDocuments({ status: 'open' })]);
  res.json({ items, total, page, hasMore: page * limit < total });
}));
pointsAdminRouter.get('/review-flags', asyncHandler(async (req, res) => {
  const page = pageOf(req), limit = limitOf(req);
  const flags = await mongoCollection('point_review_flags');
  const [items, total] = await Promise.all([flags.find({ status: 'open' }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(), flags.countDocuments({ status: 'open' })]);
  res.json({ items, total, page, hasMore: page * limit < total });
}));
pointsAdminRouter.put('/fraud/:userId', asyncHandler(async (req, res) => {
  const userId = parsePositiveInt(req.params.userId), confirmed = req.body?.confirmed, reason = req.body?.reason?.trim();
  if (typeof confirmed !== 'boolean' || typeof reason !== 'string' || reason.length < 10 || reason.length > 500) return res.status(400).json({ message: 'Decision and reason are required' });
  const changed = await withMongoTransaction(async (session) => {
    const result = await (await mongoCollection('users')).updateOne({ id: userId }, { $set: { fraud_confirmed: confirmed, fraud_reviewed_at: new Date(), fraud_reviewed_by: req.user.id } }, { session });
    if (!result.matchedCount) return false;
    await (await mongoCollection('point_admin_audit')).insertOne({ action: confirmed ? 'fraud_confirmed' : 'fraud_cleared', userId, actorId: req.user.id, reason, createdAt: new Date() }, { session });
    return true;
  });
  if (!changed) return res.status(404).json({ message: 'User not found' });
  res.json({ userId, fraudConfirmed: confirmed });
}));
pointsAdminRouter.post('/reports/:id/confirm', asyncHandler(async (req, res) => {
  const reason = req.body?.reason?.trim();
  if (typeof reason !== 'string' || reason.length < 10 || reason.length > 500) return res.status(400).json({ message: 'Reason is required' });
  const result = await resolveModerationReport(req.params.id, req.user.id, { action: 'hide', reason });
  if (!result) return res.status(409).json({ message: 'Report already reviewed' });
  res.json(result);
}));
