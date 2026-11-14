import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { mongoCollection } from '../../core/database/mongo.js';
import { requireAuth, optionalAuth } from '../../core/middleware/auth.middleware.js';
import { requireFrontendOrigin } from '../../core/middleware/origin.middleware.js';
import { asyncHandler, parsePositiveInt } from '../../core/utils/http.js';
import { createNotification } from './notification.service.js';
import { presentMany, visibleTo } from './posts.routes.js';

export const profilesRouter = Router();
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const contentType = { $in: ['community_post', null] };
const userFields = { _id: 0, id: 1, username: 1, avatar_url: 1, display_name: 1, bio: 1, created_at: 1, status: 1, vip_expires_at: 1 };
const followLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: 'draft-7', legacyHeaders: false });
let followIndexes;
const ensureFollowIndexes = () => followIndexes ||= (async () => {
  const follows = await mongoCollection('community_follows');
  await Promise.all([
    follows.createIndex({ follower_id: 1, followed_id: 1 }, { unique: true }),
    follows.createIndex({ follower_id: 1, created_at: -1 }),
    follows.createIndex({ followed_id: 1, created_at: -1 }),
  ]);
})().catch((error) => { followIndexes = undefined; throw error; });
const pageOptions = (query) => {
  const page = query.page === undefined ? 1 : parsePositiveInt(query.page, 'page');
  const limit = query.limit === undefined ? 12 : parsePositiveInt(query.limit, 'limit');
  if (page > 1000 || limit > 30) throw bad('Pagination exceeds limit');
  return { page, limit, skip: (page - 1) * limit };
};
const guardStore = (req, res, next) => process.env.DATA_STORE === 'mongodb' ? next() : res.status(503).json({ message: 'Community profiles require MongoDB' });
profilesRouter.use(guardStore);

profilesRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id, 'user id');
  const user = await (await mongoCollection('users')).findOne({ id }, { projection: userFields });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const [posts, followers, following, isFollowing] = await Promise.all([
    (await mongoCollection('community_posts')).countDocuments({ author_id: id, status: 'active', content_type: contentType, ...await visibleTo(req.user) }),
    (await mongoCollection('community_follows')).countDocuments({ followed_id: id }),
    (await mongoCollection('community_follows')).countDocuments({ follower_id: id }),
    req.user ? (await mongoCollection('community_follows')).findOne({ follower_id: req.user.id, followed_id: id }) : null,
  ]);
  const { status, ...publicUser } = user;
  res.json({ ...publicUser, counts: { posts, followers, following }, isFollowing: Boolean(isFollowing), isSelf: req.user?.id === id, canFollow: status === 'active' && req.user?.id !== id });
}));

profilesRouter.patch('/me', requireAuth, requireFrontendOrigin, asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['bio', 'displayName'].includes(key)) || !Object.keys(body).length) throw bad('Invalid profile fields');
  const updates = {};
  if ('bio' in body) {
    if (typeof body.bio !== 'string' || body.bio.length > 500) throw bad('Bio must be at most 500 characters');
    updates.bio = body.bio.trim();
  }
  if ('displayName' in body) {
    if (typeof body.displayName !== 'string' || body.displayName.length > 80) throw bad('Display name must be at most 80 characters');
    updates.display_name = body.displayName.trim();
  }
  const result = await (await mongoCollection('users')).findOneAndUpdate({ id: req.user.id, status: 'active' }, { $set: { ...updates, updated_at: new Date() } }, { returnDocument: 'after', projection: userFields });
  if (!result) return res.status(404).json({ message: 'User not found' });
  const { status, ...publicUser } = result;
  res.json(publicUser);
}));

profilesRouter.put('/:id/follow', requireAuth, requireFrontendOrigin, followLimiter, asyncHandler(async (req, res) => {
  const targetId = parsePositiveInt(req.params.id, 'user id');
  if (targetId === req.user.id) throw bad('Cannot follow yourself');
  const target = await (await mongoCollection('users')).findOne({ id: targetId, status: 'active' }, { projection: { id: 1 } });
  if (!target) return res.status(404).json({ message: 'User not found' });
  await ensureFollowIndexes();
  const follows = await mongoCollection('community_follows');
  const now = new Date();
  let created = false;
  try { await follows.insertOne({ _id: `${req.user.id}:${targetId}`, follower_id: req.user.id, followed_id: targetId, created_at: now }); created = true; }
  catch (error) { if (error.code !== 11000) throw error; }
  if (created) {
    try { await createNotification({ recipientId: targetId, actorId: req.user.id, type: 'follow', title: `${req.user.username} đã theo dõi bạn`, message: 'Có người mới theo dõi hồ sơ cộng đồng của bạn.', entityType: 'user', entityId: req.user.id, redirectUrl: `/community/users/${req.user.id}`, deduplicationKey: `follow:${req.user.id}:${targetId}:${now.getTime()}`, metadata: { actorAvatar: req.user.avatarUrl || null } }); }
    catch (error) { console.error('Follow notification:', error); }
  }
  res.json({ isFollowing: true, followers: await follows.countDocuments({ followed_id: targetId }) });
}));

profilesRouter.delete('/:id/follow', requireAuth, requireFrontendOrigin, followLimiter, asyncHandler(async (req, res) => {
  const targetId = parsePositiveInt(req.params.id, 'user id');
  if (targetId === req.user.id) throw bad('Cannot follow yourself');
  const follows = await mongoCollection('community_follows');
  await follows.deleteOne({ _id: `${req.user.id}:${targetId}`, follower_id: req.user.id });
  res.json({ isFollowing: false, followers: await follows.countDocuments({ followed_id: targetId }) });
}));

profilesRouter.get(['/:id/followers', '/:id/following'], optionalAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id, 'user id');
  if (!await (await mongoCollection('users')).findOne({ id }, { projection: { id: 1 } })) return res.status(404).json({ message: 'User not found' });
  const { page, limit, skip } = pageOptions(req.query);
  const followers = req.path.endsWith('/followers');
  const rows = await (await mongoCollection('community_follows')).find({ [followers ? 'followed_id' : 'follower_id']: id }).sort({ created_at: -1 }).skip(skip).limit(limit + 1).toArray();
  const users = await (await mongoCollection('users')).find({ id: { $in: rows.map((row) => followers ? row.follower_id : row.followed_id) } }, { projection: userFields }).toArray();
  const byId = new Map(users.map((user) => [user.id, user]));
  res.json({ items: rows.slice(0, limit).flatMap((row) => { const user = byId.get(followers ? row.follower_id : row.followed_id); if (!user) return []; const { status, ...publicUser } = user; return [publicUser]; }), page, hasMore: rows.length > limit });
}));

profilesRouter.get('/:id/activity', optionalAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id, 'user id');
  if (!await (await mongoCollection('users')).findOne({ id }, { projection: { id: 1 } })) return res.status(404).json({ message: 'User not found' });
  const tab = req.query.tab || 'posts';
  if (!['posts', 'reviews', 'comments', 'liked'].includes(tab)) throw bad('Invalid activity tab');
  if (tab === 'liked' && req.user?.id !== id) return res.status(403).json({ message: 'Only the profile owner can view liked posts' });
  const { page, limit, skip } = pageOptions(req.query);
  const visibility = await visibleTo(req.user);
  if (tab === 'comments') {
    const comments = await (await mongoCollection('community_post_comments')).find({ author_id: id, status: 'active' }).sort({ created_at: -1, _id: -1 }).skip(skip).limit(limit + 1).toArray();
    const posts = await (await mongoCollection('community_posts')).find({ _id: { $in: comments.map((item) => item.post_id) }, content_type: contentType, status: 'active', ...visibility }, { projection: { _id: 1, title: 1 } }).toArray();
    const byId = new Map(posts.map((post) => [post._id, post]));
    return res.json({ items: comments.slice(0, limit).flatMap((item) => byId.has(item.post_id) ? [{ id: item.id, content: item.content, created_at: item.created_at, post_id: item.post_id, post_title: byId.get(item.post_id).title }] : []), page, hasMore: comments.length > limit });
  }
  let ids;
  if (tab === 'liked') {
    const votes = await (await mongoCollection('community_post_votes')).find({ user_id: id, value: 1 }).sort({ _id: -1 }).skip(skip).limit(limit + 1).toArray();
    ids = votes.map((vote) => vote.post_id);
  }
  const filter = { content_type: contentType, status: 'active', ...visibility, ...(ids ? { _id: { $in: ids } } : { author_id: id }), ...(tab === 'reviews' && { category: 'review' }) };
  const posts = await (await mongoCollection('community_posts')).find(filter).sort({ created_at: -1, _id: -1 }).skip(ids ? 0 : skip).limit(limit + 1).toArray();
  res.json({ items: await presentMany(posts.slice(0, limit), req.user?.id), page, hasMore: posts.length > limit });
}));
