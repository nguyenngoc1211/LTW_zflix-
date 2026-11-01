import { Router } from 'express';
import { mongoCollection, nextNumericId, withMongoTransaction } from '../../core/database/mongo.js';
import { requireAuth, optionalAuth } from '../../core/middleware/auth.middleware.js';
import { asyncHandler, parsePositiveInt } from '../../core/utils/http.js';
import multer from 'multer';
import { uploadPostImages, cleanupPostImages } from './post-images.js';
import { toPublicMediaUrl } from '../../core/storage/public-url.js';

export const postsRouter = Router();
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const present = (post) => ({ ...post, image_urls: (post.images || []).map((key) => key.startsWith('local/community/posts/') ? `/uploads/${key.slice(6)}` : toPublicMediaUrl(key)).filter(Boolean) });
const allowed = new Set(['title', 'content', 'productionId', 'episodeId', 'communityId', 'tags', 'isSpoiler', 'visibility']);
const validate = async (body, previous = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !allowed.has(key))) throw bad('Invalid post fields');
  const post = { ...previous };
  if ('title' in body) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) throw bad('Invalid title');
    post.title = body.title.trim();
  }
  if ('content' in body) {
    if (typeof body.content !== 'string' || body.content.length > 10000) throw bad('Invalid content');
    post.content = body.content.trim();
  }
  if (!post.title || post.content === undefined) throw bad('Title and content are required');
  for (const [input, output] of [['productionId', 'production_id'], ['episodeId', 'episode_id'], ['communityId', 'community_id']]) {
    if (input in body) {
      if (body[input] === null) delete post[output];
      else post[output] = parsePositiveInt(body[input], input);
    }
  }
  if ('tags' in body) {
    if (!Array.isArray(body.tags) || body.tags.length > 20 || body.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 50)) throw bad('Invalid tags');
    post.tags = [...new Set(body.tags.map((tag) => tag.trim()))];
  }
  if ('isSpoiler' in body) {
    if (typeof body.isSpoiler !== 'boolean') throw bad('Invalid spoiler flag');
    post.is_spoiler = body.isSpoiler;
  }
  if ('visibility' in body) {
    if (!['public', 'members'].includes(body.visibility)) throw bad('Invalid visibility');
    post.visibility = body.visibility;
  }
  if (post.visibility === 'members' && !post.community_id) throw bad('Members-only posts require a community');
  if (post.production_id && !await (await mongoCollection('productions')).findOne({ id: post.production_id })) throw bad('Production not found');
  if (post.episode_id) {
    if (!post.production_id) throw bad('Episode requires a production');
    const episode = await (await mongoCollection('episodes')).findOne({ id: post.episode_id });
    const season = episode && await (await mongoCollection('seasons')).findOne({ id: episode.production_id });
    if (!episode || (episode.production_id !== post.production_id && season?.series_id !== post.production_id)) throw bad('Episode does not belong to production');
  }
  return post;
};
const guardStore = (req, res, next) => process.env.DATA_STORE === 'mongodb' ? next() : res.status(503).json({ message: 'Community posts require MongoDB' });
const requireMembership = async (communityId, userId) => {
  if (!communityId) return;
  const group = await (await mongoCollection('community_groups')).findOne({ _id: communityId, status: 'active' });
  const member = await (await mongoCollection('community_members')).findOne({ community_id: communityId, user_id: userId, status: 'active' });
  if (!group || !member) throw Object.assign(new Error('Active community membership required'), { status: 403 });
};
const visibleTo = async (user) => {
  if (!user) return { visibility: 'public' };
  const memberships = await (await mongoCollection('community_members')).find({ user_id: user.id, status: 'active' }, { projection: { community_id: 1 } }).toArray();
  const groups = await (await mongoCollection('community_groups')).find({ _id: { $in: memberships.map((item) => item.community_id) }, status: 'active' }, { projection: { _id: 1 } }).toArray();
  return { $or: [{ visibility: 'public' }, { visibility: 'members', community_id: { $in: groups.map((group) => group._id) } }] };
};
postsRouter.use(guardStore);
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 1 } });
postsRouter.post('/with-images', requireAuth, (req, res, next) => imageUpload.array('images', 5)(req, res, (error) => {
  if (error) return res.status(400).json({ message: 'Invalid upload or image exceeds 5 MB' });
  return next();
}), asyncHandler(async (req, res) => {
  if (!req.files?.length || typeof req.body?.post !== 'string') throw bad('Images and post JSON are required');
  let input;
  try { input = JSON.parse(req.body.post); } catch { throw bad('Invalid post JSON'); }
  const { type = 'normal', timestampSeconds, ...postInput } = input || {};
  if (!['normal', 'screenshot'].includes(type)) throw bad('Invalid post type');
  if (type === 'normal' && timestampSeconds !== undefined) throw bad('Timestamp requires a screenshot');
  const fields = await validate(postInput);
  await requireMembership(fields.community_id, req.user.id);
  if (fields.visibility === 'members') throw bad('Members-only image posts are not supported by public storage');
  if (type === 'screenshot') {
    if (req.files.length !== 1 || !fields.production_id || !fields.episode_id || typeof timestampSeconds !== 'number' || !Number.isFinite(timestampSeconds) || timestampSeconds < 0) throw bad('Screenshot requires one image, production, episode and timestamp');
    const episode = await (await mongoCollection('episodes')).findOne({ id: fields.episode_id }, { projection: { duration: 1 } });
    if (Number(episode?.duration) > 0 && timestampSeconds > Number(episode.duration)) throw bad('Timestamp exceeds episode duration');
  }
  const id = await nextNumericId('community_posts');
  const keys = await uploadPostImages(req.files);
  const now = new Date();
  const post = { _id: id, id, author_id: req.user.id, type, visibility: 'public', ...fields, images: keys, ...(type === 'screenshot' && { screenshot_key: keys[0], timestamp_seconds: timestampSeconds }), status: 'active', is_spoiler: fields.is_spoiler ?? false, show_on_movie_page: type === 'screenshot', upvotes: 0, downvotes: 0, score: 0, comment_count: 0, created_at: now, updated_at: now };
  try {
    await (await mongoCollection('community_posts')).insertOne(post);
  } catch (error) {
    // A failed acknowledgement can still mean the insert succeeded. Verify
    // before removing assets; if verification fails retain cleanup intents.
    let exists;
    try { exists = await (await mongoCollection('community_posts')).findOne({ _id: id }); } catch { throw error; }
    if (!exists) await cleanupPostImages(keys);
    throw error;
  }
  // Pending records are retained if cleanup fails; a reconciler must check
  // whether each key is referenced before deleting it.
  try { await (await mongoCollection('community_upload_cleanup')).deleteMany({ _id: { $in: keys } }); }
  catch (error) { console.error('Community upload reconciliation pending', error.message); }
  res.status(201).json(present(post));
}));
postsRouter.get('/saved', requireAuth, asyncHandler(async (req, res) => {
  const saved = await (await mongoCollection('community_saved_posts')).find({ user_id: req.user.id }).sort({ created_at: -1 }).limit(100).toArray();
  const posts = await (await mongoCollection('community_posts')).find({ _id: { $in: saved.map((item) => item.post_id) }, status: 'active', ...await visibleTo(req.user) }).toArray();
  const byId = new Map(posts.map((post) => [post._id, post]));
  res.json({ items: saved.flatMap((item) => byId.has(item.post_id) ? [present(byId.get(item.post_id))] : []) });
}));
postsRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const filter = { status: 'active', ...await visibleTo(req.user) };
  for (const [key, field] of [['movieId', 'production_id'], ['episodeId', 'episode_id'], ['communityId', 'community_id']]) if (req.query[key] !== undefined) filter[field] = parsePositiveInt(req.query[key], key);
  if (req.query.onMoviePage === 'true') filter.show_on_movie_page = true;
  if (req.query.type !== undefined) {
    if (!['normal', 'screenshot'].includes(req.query.type)) throw bad('Invalid type');
    filter.type = req.query.type;
  }
  const sort = req.query.sort || 'newest';
  if (!['newest', 'popular', 'hot'].includes(sort)) throw bad('Invalid sort');
  const page = req.query.page === undefined ? 1 : parsePositiveInt(req.query.page, 'page');
  const limit = req.query.limit === undefined ? 12 : parsePositiveInt(req.query.limit, 'limit');
  if (limit > 50 || page > 1000) throw bad('Pagination exceeds limit');
  // Hot uses score within the last seven days; popular uses total score.
  if (sort === 'hot') filter.created_at = { $gte: new Date(Date.now() - 7 * 86400000) };
  const order = sort === 'newest' ? { created_at: -1, _id: -1 } : { score: -1, created_at: -1, _id: -1 };
  const items = await (await mongoCollection('community_posts')).find(filter).sort(order).skip((page - 1) * limit).limit(limit + 1).toArray();
  res.json({ items: items.slice(0, limit).map(present), page, hasMore: items.length > limit });
}));
postsRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const post = await (await mongoCollection('community_posts')).findOne({ _id: id, status: 'active', ...await visibleTo(req.user) });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(present(post));
}));
postsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const fields = await validate(req.body);
  await requireMembership(fields.community_id, req.user.id);
  const id = await nextNumericId('community_posts');
  const now = new Date();
  const post = { _id: id, id, author_id: req.user.id, type: 'normal', visibility: 'public', ...fields, status: 'active', is_spoiler: fields.is_spoiler ?? false, show_on_movie_page: false, upvotes: 0, downvotes: 0, score: 0, comment_count: 0, created_at: now, updated_at: now };
  await (await mongoCollection('community_posts')).insertOne(post);
  res.status(201).json(present(post));
}));
postsRouter.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const collection = await mongoCollection('community_posts');
  const existing = await collection.findOne({ _id: id, author_id: req.user.id, status: 'active' });
  if (!existing) return res.status(404).json({ message: 'Post not found' });
  if (existing.type === 'screenshot' && ('productionId' in req.body || 'episodeId' in req.body)) throw bad('Screenshot movie and episode cannot be changed');
  const fields = await validate(req.body, { title: existing.title, content: existing.content, visibility: existing.visibility, ...(existing.production_id && { production_id: existing.production_id }), ...(existing.episode_id && { episode_id: existing.episode_id }), ...(existing.community_id && { community_id: existing.community_id }), tags: existing.tags || [], is_spoiler: existing.is_spoiler });
  if (fields.visibility === 'members' && (existing.images?.length || existing.screenshot_key)) throw bad('Members-only image posts are not supported by public storage');
  if ('communityId' in req.body || fields.visibility === 'members') await requireMembership(fields.community_id, req.user.id);
  const unset = {};
  for (const field of ['production_id', 'episode_id', 'community_id']) if (!(field in fields)) unset[field] = '';
  const result = await collection.findOneAndUpdate({ _id: id, author_id: req.user.id, status: 'active', updated_at: existing.updated_at }, { $set: { ...fields, updated_at: new Date() }, ...(Object.keys(unset).length && { $unset: unset }) }, { returnDocument: 'after' });
  if (!result) return res.status(409).json({ message: 'Post changed; retry' });
  res.json(present(result));
}));
postsRouter.put('/:id/save', requireAuth, asyncHandler(async (req, res) => {
  const postId = parsePositiveInt(req.params.id);
  if (!await (await mongoCollection('community_posts')).findOne({ _id: postId, status: 'active', ...await visibleTo(req.user) })) return res.status(404).json({ message: 'Post not found' });
  const saved = await mongoCollection('community_saved_posts');
  await saved.updateOne({ user_id: req.user.id, post_id: postId }, { $setOnInsert: { user_id: req.user.id, post_id: postId, created_at: new Date() } }, { upsert: true });
  res.status(204).end();
}));
postsRouter.put('/:id/vote', requireAuth, asyncHandler(async (req, res) => {
  const postId = parsePositiveInt(req.params.id);
  const value = req.body?.value;
  if (![0, 1, -1].includes(value) || Object.keys(req.body).some((key) => key !== 'value')) throw bad('Vote must be -1, 0 or 1');
  const visibility = await visibleTo(req.user);
  const result = await withMongoTransaction(async (session) => {
    const posts = await mongoCollection('community_posts');
    const votes = await mongoCollection('community_post_votes');
    const post = await posts.findOne({ _id: postId, status: 'active', ...visibility }, { session });
    if (!post) return null;
    const previous = await votes.findOne({ post_id: postId, user_id: req.user.id }, { session });
    const old = previous?.value || 0;
    if (value === 0) await votes.deleteOne({ post_id: postId, user_id: req.user.id }, { session });
    else await votes.updateOne({ post_id: postId, user_id: req.user.id }, { $set: { value }, $setOnInsert: { post_id: postId, user_id: req.user.id } }, { upsert: true, session });
    const updated = await posts.findOneAndUpdate({ _id: postId, status: 'active' }, { $inc: { upvotes: Number(value === 1) - Number(old === 1), downvotes: Number(value === -1) - Number(old === -1), score: value - old }, $set: { updated_at: new Date() } }, { session, returnDocument: 'after' });
    return updated ? { score: updated.score, upvotes: updated.upvotes, downvotes: updated.downvotes, value } : null;
  });
  if (!result) return res.status(404).json({ message: 'Post not found' });
  res.json(result);
}));
postsRouter.get('/:id/comments', optionalAuth, asyncHandler(async (req, res) => {
  const postId = parsePositiveInt(req.params.id);
  if (!await (await mongoCollection('community_posts')).findOne({ _id: postId, status: 'active', ...await visibleTo(req.user) })) return res.status(404).json({ message: 'Post not found' });
  const parent = req.query.parentId === undefined ? { $exists: false } : parsePositiveInt(req.query.parentId, 'parentId');
  const page = req.query.page === undefined ? 1 : parsePositiveInt(req.query.page, 'page');
  if (page > 1000) throw bad('Pagination exceeds limit');
  const items = await (await mongoCollection('community_post_comments')).find({ post_id: postId, parent_id: parent, status: { $in: ['active', 'deleted'] } }).sort({ created_at: 1, _id: 1 }).skip((page - 1) * 20).limit(21).toArray();
  res.json({ items: items.slice(0, 20), page, hasMore: items.length > 20 });
}));
postsRouter.post('/:id/comments', requireAuth, asyncHandler(async (req, res) => {
  const postId = parsePositiveInt(req.params.id);
  const body = req.body;
  if (!body || Object.keys(body).some((key) => !['content', 'parentId', 'isSpoiler'].includes(key)) || typeof body.content !== 'string' || !body.content.trim() || body.content.trim().length > 3000 || ('isSpoiler' in body && typeof body.isSpoiler !== 'boolean')) throw bad('Invalid comment');
  const parentId = body.parentId == null ? null : parsePositiveInt(body.parentId, 'parentId');
  const visibility = await visibleTo(req.user);
  const id = await nextNumericId('community_post_comments');
  const result = await withMongoTransaction(async (session) => {
    const posts = await mongoCollection('community_posts');
    const comments = await mongoCollection('community_post_comments');
    if (!await posts.findOne({ _id: postId, status: 'active', ...visibility }, { session })) return null;
    let depth = 0;
    if (parentId) {
      const parent = await comments.findOne({ _id: parentId, post_id: postId, status: 'active' }, { session });
      if (!parent || !Number.isInteger(parent.depth) || parent.depth >= 3) throw bad('Invalid parent or maximum depth reached');
      depth = parent.depth + 1;
    }
    const now = new Date();
    const comment = { _id: id, id, post_id: postId, author_id: req.user.id, content: body.content.trim(), ...(parentId && { parent_id: parentId }), depth, is_spoiler: body.isSpoiler ?? false, status: 'active', created_at: now, updated_at: now };
    await comments.insertOne(comment, { session });
    await posts.updateOne({ _id: postId, status: 'active' }, { $inc: { comment_count: 1 } }, { session });
    return comment;
  });
  if (!result) return res.status(404).json({ message: 'Post not found' });
  res.status(201).json(result);
}));
postsRouter.patch('/:id/comments/:commentId', requireAuth, asyncHandler(async (req, res) => {
  const postId = parsePositiveInt(req.params.id), commentId = parsePositiveInt(req.params.commentId);
  const body = req.body;
  if (!body || Object.keys(body).some((key) => !['content', 'isSpoiler'].includes(key)) || typeof body.content !== 'string' || !body.content.trim() || body.content.trim().length > 3000 || ('isSpoiler' in body && typeof body.isSpoiler !== 'boolean')) throw bad('Invalid comment');
  if (!await (await mongoCollection('community_posts')).findOne({ _id: postId, status: 'active', ...await visibleTo(req.user) })) return res.status(404).json({ message: 'Post not found' });
  const updates = { content: body.content.trim(), updated_at: new Date(), ...('isSpoiler' in body && { is_spoiler: body.isSpoiler }) };
  const result = await (await mongoCollection('community_post_comments')).findOneAndUpdate({ _id: commentId, post_id: postId, author_id: req.user.id, status: 'active' }, { $set: updates }, { returnDocument: 'after' });
  if (!result) return res.status(404).json({ message: 'Comment not found' });
  res.json(result);
}));
postsRouter.delete('/:id/comments/:commentId', requireAuth, asyncHandler(async (req, res) => {
  const postId = parsePositiveInt(req.params.id), commentId = parsePositiveInt(req.params.commentId);
  const visibility = await visibleTo(req.user);
  const deleted = await withMongoTransaction(async (session) => {
    const posts = await mongoCollection('community_posts');
    if (!await posts.findOne({ _id: postId, status: 'active', ...visibility }, { session })) return false;
    const result = await (await mongoCollection('community_post_comments')).updateOne({ _id: commentId, post_id: postId, author_id: req.user.id, status: 'active' }, { $set: { status: 'deleted', content: '[Đã xóa]', updated_at: new Date() } }, { session });
    if (!result.matchedCount) return false;
    await posts.updateOne({ _id: postId, status: 'active', comment_count: { $gt: 0 } }, { $inc: { comment_count: -1 } }, { session });
    return true;
  });
  if (!deleted) return res.status(404).json({ message: 'Comment not found' });
  res.status(204).end();
}));
postsRouter.delete('/:id/save', requireAuth, asyncHandler(async (req, res) => {
  await (await mongoCollection('community_saved_posts')).deleteOne({ user_id: req.user.id, post_id: parsePositiveInt(req.params.id) });
  res.status(204).end();
}));
postsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const collection = await mongoCollection('community_posts');
  const post = await collection.findOne({ _id: id, status: 'active' });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  let permitted = post.author_id === req.user.id || ['admin', 'moderator'].includes(req.user.role);
  if (!permitted && post.community_id) permitted = Boolean(await (await mongoCollection('community_members')).findOne({ community_id: post.community_id, user_id: req.user.id, status: 'active', role: { $in: ['owner', 'moderator'] } }));
  if (!permitted) return res.status(404).json({ message: 'Post not found' });
  const result = await collection.updateOne({ _id: id, status: 'active', updated_at: post.updated_at, ...(post.community_id ? { community_id: post.community_id } : { community_id: { $exists: false } }) }, { $set: { status: 'deleted', updated_at: new Date() } });
  if (!result.matchedCount) return res.status(404).json({ message: 'Post not found' });
  res.status(204).end();
}));
