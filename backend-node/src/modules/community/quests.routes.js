import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { mongoCollection, withMongoTransaction } from '../../core/database/mongo.js';
import { requireAuth } from '../../core/middleware/auth.middleware.js';
import { asyncHandler, parsePositiveInt } from '../../core/utils/http.js';
import { achievementStatus, claimQuest, DEFAULT_ACHIEVEMENTS, DEFAULT_QUESTS, ensureQuestIndexes, questStatus, validateAchievement, validateQuest } from './quests.service.js';

export const questsRouter = Router();
export const questsAdminRouter = Router();
const mongoOnly = (_req, res, next) => process.env.DATA_STORE === 'mongodb' ? next() : res.status(503).json({ message: 'Quests require MongoDB' });
const adminOnly = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin required' });
questsRouter.use(mongoOnly);
questsAdminRouter.use(mongoOnly, requireAuth, adminOnly);
const claimLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

questsRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [quests, achievements, history] = await Promise.all([
    questStatus(req.user.id), achievementStatus(req.user.id),
    (await mongoCollection('quest_claims')).find({ userId: req.user.id }, { projection: { _id: 0, questId: 1, period: 1, points: 1, status: 1, claimedAt: 1 } }).sort({ claimedAt: -1 }).limit(30).toArray(),
  ]);
  res.json({ ...quests, achievements, history });
}));
questsRouter.post('/:id/claim', requireAuth, claimLimiter, asyncHandler(async (req, res) => {
  const result = await claimQuest(req.user.id, String(req.params.id));
  res.status(201).json(result);
}));
questsRouter.get('/achievements/:userId', asyncHandler(async (req, res) => {
  const userId = parsePositiveInt(req.params.userId);
  const user = await (await mongoCollection('users')).findOne({ id: userId, status: 'active' }, { projection: { id: 1 } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ items: (await achievementStatus(userId)).filter((item) => item.earned) });
}));

questsAdminRouter.get('/definitions', asyncHandler(async (_req, res) => {
  const [questChanges, achievementChanges] = await Promise.all([
    (await mongoCollection('quest_definitions')).find({}, { projection: { _id: 0 } }).toArray(),
    (await mongoCollection('achievement_definitions')).find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  const merge = (defaults, changes) => {
    const map = new Map(defaults.map((item) => [item.id, { ...item, enabled: true, builtIn: true }]));
    for (const item of changes) map.set(item.id, { ...item, builtIn: defaults.some((entry) => entry.id === item.id) });
    return [...map.values()];
  };
  res.json({ quests: merge(DEFAULT_QUESTS, questChanges), achievements: merge(DEFAULT_ACHIEVEMENTS, achievementChanges) });
}));

questsAdminRouter.put('/definitions/:kind/:id', asyncHandler(async (req, res) => {
  const kind = req.params.kind, id = req.params.id, body = req.body || {};
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const candidate = { ...body, id };
  const valid = kind === 'quests' ? validateQuest(candidate) : kind === 'achievements' ? validateAchievement(candidate) : false;
  if (!valid || typeof body.enabled !== 'boolean' || reason.length < 10 || reason.length > 500) return res.status(400).json({ message: 'Invalid definition or reason' });
  await ensureQuestIndexes();
  const isQuest = kind === 'quests';
  const record = isQuest
    ? { id, title: body.title.trim(), cadence: body.cadence, action: body.action, target: body.target, points: body.points, enabled: body.enabled }
    : { id, title: body.title.trim(), description: body.description.trim(), icon: body.icon, action: body.action, target: body.target, enabled: body.enabled };
  await withMongoTransaction(async (session) => {
    const collection = await mongoCollection(isQuest ? 'quest_definitions' : 'achievement_definitions');
    const old = await collection.findOne({ _id: id }, { session });
    const defaults = isQuest ? DEFAULT_QUESTS : DEFAULT_ACHIEVEMENTS;
    const before = old || defaults.find((item) => item.id === id) || null;
    // A changed definition starts counting new valid actions from this edit onward.
    const changed = JSON.stringify(before && Object.fromEntries(Object.keys(record).map((key) => [key, before[key] ?? (key === 'enabled' ? true : undefined)]))) !== JSON.stringify(record);
    await collection.updateOne({ _id: id }, { $set: { ...record, activeFrom: changed ? new Date() : old?.activeFrom || new Date('2026-11-20T17:00:00.000Z'), updatedAt: new Date(), updatedBy: req.user.id } }, { upsert: true, session });
    await (await mongoCollection('point_admin_audit')).insertOne({ action: isQuest ? 'quest_definition_update' : 'achievement_definition_update', definitionId: id, before, after: record, actorId: req.user.id, reason, createdAt: new Date() }, { session });
  });
  res.json(record);
}));

// Existing Community DELETE route performs point and quest reversal in its source transaction.
questsAdminRouter.get('/community-posts', asyncHandler(async (req, res) => {
  const page = Math.min(parsePositiveInt(req.query.page || 1), 1000), limit = 20;
  const posts = await mongoCollection('community_posts');
  const filter = { status: 'active' };
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
  if (category && !['review', 'discussion', 'question', 'news', 'meme', 'poll', 'scene_question'].includes(category)) return res.status(400).json({ message: 'Invalid category' });
  if (!['newest', 'oldest', 'most_comments', 'most_votes'].includes(sort)) return res.status(400).json({ message: 'Invalid sort' });
  if (category) Object.assign(filter, category === 'scene_question' ? { content_type: 'scene_question' } : { category });
  if (search) filter.$or = [{ title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { content: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }];
  const order = { newest: { created_at: -1, _id: -1 }, oldest: { created_at: 1, _id: 1 }, most_comments: { comment_count: -1, created_at: -1, _id: -1 }, most_votes: { upvotes: -1, created_at: -1, _id: -1 } }[sort];
  const [items, total] = await Promise.all([
    posts.find(filter, { projection: { _id: 0, id: 1, title: 1, author_id: 1, category: 1, content_type: 1, created_at: 1, comment_count: 1, upvotes: 1, downvotes: 1, visibility: 1 } }).sort(order).skip((page - 1) * limit).limit(limit).toArray(),
    posts.countDocuments(filter),
  ]);
  const authors = await (await mongoCollection('users')).find({ id: { $in: items.map((item) => item.author_id) } }, { projection: { _id: 0, id: 1, username: 1 } }).toArray();
  const authorById = new Map(authors.map((author) => [author.id, author.username]));
  res.json({ items: items.map((item) => ({ ...item, author_name: authorById.get(item.author_id) || null })), total, page, hasMore: page * limit < total });
}));
