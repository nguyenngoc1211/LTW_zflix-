import { Router } from 'express';
import { mongoCollection, nextNumericId, withMongoTransaction } from '../../core/database/mongo.js';
import { requireAuth, optionalAuth } from '../../core/middleware/auth.middleware.js';
import { asyncHandler, parsePositiveInt } from '../../core/utils/http.js';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { uploadPostImages, cleanupPostImages } from './post-images.js';
import { toPublicMediaUrl } from '../../core/storage/public-url.js';

export const postsRouter = Router();
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const present = (post) => ({ ...post, image_urls: (post.images || []).map((key) => key.startsWith('local/community/posts/') ? `/uploads/${key.slice(6)}` : toPublicMediaUrl(key)).filter(Boolean) });
const presentMany = async (posts, userId) => {
  if (!posts.length) return [];
  const authorIds = [...new Set(posts.map((post) => post.author_id))];
  const [authors, saved, votes, totals] = await Promise.all([
    (await mongoCollection('users')).find({ id: { $in: authorIds } }, { projection: { _id: 0, id: 1, username: 1, avatar_url: 1 } }).toArray(),
    userId ? (await mongoCollection('community_saved_posts')).find({ user_id: userId, post_id: { $in: posts.map((post) => post._id) } }, { projection: { post_id: 1 } }).toArray() : [],
    userId ? (await mongoCollection('community_post_votes')).find({ user_id: userId, post_id: { $in: posts.map((post) => post._id) } }, { projection: { post_id: 1, value: 1 } }).toArray() : [],
    (await mongoCollection('community_post_votes')).aggregate([{ $match: { post_id: { $in: posts.map((post) => post._id) } } }, { $group: { _id: '$post_id', upvotes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } }, downvotes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } } } }]).toArray(),
  ]);
  const byId = new Map(authors.map((author) => [author.id, author]));
  const savedIds = new Set(saved.map((entry) => entry.post_id));
  const voteById = new Map(votes.map((entry) => [entry.post_id, entry.value]));
  const totalsById = new Map(totals.map((entry) => [entry._id, entry]));
  return posts.map((post) => ({ ...present(post), author: byId.get(post.author_id) || null, is_saved: userId ? savedIds.has(post._id) : false, viewer_vote: voteById.get(post._id) || 0, upvotes: totalsById.get(post._id)?.upvotes || 0, downvotes: totalsById.get(post._id)?.downvotes || 0 }));
};
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
const isScene = (req) => req.baseUrl === '/api/v1/scene-questions';
const contentFilter = (req) => isScene(req) ? 'scene_question' : { $in: ['community_post', null] };
postsRouter.param('id', async (req, res, next, value) => {
  try {
    const id = parsePositiveInt(value);
    const post = await (await mongoCollection('community_posts')).findOne({ _id: id, content_type: contentFilter(req) }, { projection: { _id: 1 } });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    return next();
  } catch (error) { return next(error); }
});
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 1 } });
postsRouter.post('/with-images', requireAuth, (req, res, next) => imageUpload.array('images', 5)(req, res, (error) => {
  if (error) return res.status(400).json({ message: 'Invalid upload or image exceeds 5 MB' });
  return next();
}), asyncHandler(async (req, res) => {
  if (!req.files?.length || typeof req.body?.post !== 'string') throw bad('Images and post JSON are required');
  let input;
  try { input = JSON.parse(req.body.post); } catch { throw bad('Invalid post JSON'); }
  const { type = 'normal', timestampSeconds, ...postInput } = input || {};
  if (isScene(req) && (type !== 'screenshot' || 'communityId' in postInput || typeof postInput.title !== 'string' || !postInput.title.trim())) throw bad('Scene questions require a screenshot and question');
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
  const post = { _id: id, id, author_id: req.user.id, type, content_type: isScene(req) ? 'scene_question' : 'community_post', visibility: 'public', ...fields, images: keys, ...(type === 'screenshot' && { screenshot_key: keys[0], timestamp_seconds: timestampSeconds }), status: 'active', is_spoiler: fields.is_spoiler ?? false, show_on_movie_page: isScene(req), upvotes: 0, downvotes: 0, score: 0, comment_count: 0, created_at: now, updated_at: now };
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
  res.status(201).json((await presentMany([post], req.user.id))[0]);
}));
postsRouter.get('/saved', requireAuth, asyncHandler(async (req, res) => {
  if (isScene(req)) return res.status(404).json({ message: 'Not found' });
  const saved = await (await mongoCollection('community_saved_posts')).find({ user_id: req.user.id }).sort({ created_at: -1 }).limit(100).toArray();
  const posts = await (await mongoCollection('community_posts')).find({ _id: { $in: saved.map((item) => item.post_id) }, content_type: contentFilter(req), status: 'active', ...await visibleTo(req.user) }).toArray();
  const byId = new Map(posts.map((post) => [post._id, post]));
  res.json({ items: await presentMany(saved.flatMap((item) => byId.has(item.post_id) ? [byId.get(item.post_id)] : []), req.user.id) });
}));
postsRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const filter = { status: 'active', content_type: contentFilter(req), ...await visibleTo(req.user) };
  if (isScene(req) && req.query.movieId === undefined) throw bad('movieId is required');
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
  res.json({ items: await presentMany(items.slice(0, limit), req.user?.id), page, hasMore: items.length > limit });
}));
postsRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id);
  const post = await (await mongoCollection('community_posts')).findOne({ _id: id, status: 'active', ...await visibleTo(req.user) });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json((await presentMany([post], req.user?.id))[0]);
}));
postsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  if (isScene(req)) return res.status(404).json({ message: 'Not found' });
  const fields = await validate(req.body);
  await requireMembership(fields.community_id, req.user.id);
  const id = await nextNumericId('community_posts');
  const now = new Date();
  const post = { _id: id, id, author_id: req.user.id, type: 'normal', content_type: 'community_post', visibility: 'public', ...fields, status: 'active', is_spoiler: fields.is_spoiler ?? false, show_on_movie_page: false, upvotes: 0, downvotes: 0, score: 0, comment_count: 0, created_at: now, updated_at: now };
  await (await mongoCollection('community_posts')).insertOne(post);
  res.status(201).json((await presentMany([post], req.user.id))[0]);
}));
postsRouter.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  if (isScene(req) && Object.keys(req.body || {}).some((key) => !['title', 'content', 'isSpoiler'].includes(key))) throw bad('Invalid scene question fields');
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
  res.json((await presentMany([result], req.user.id))[0]);
}));
postsRouter.put('/:id/save', requireAuth, asyncHandler(async (req, res) => {
  if (isScene(req)) return res.status(404).json({ message: 'Not found' });
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
    if (!updated) return null;
    const upvotes = await votes.countDocuments({ post_id: postId, value: 1 }, { session });
    const downvotes = await votes.countDocuments({ post_id: postId, value: -1 }, { session });
    return { score: updated.score, upvotes, downvotes, value };
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
  const visible = items.slice(0, 20);
  const authors = await (await mongoCollection('users')).find({ id: { $in: [...new Set(visible.map((item) => item.author_id))] } }, { projection: { _id: 0, id: 1, username: 1, avatar_url: 1 } }).toArray();
  const byId = new Map(authors.map((author) => [author.id, author]));
  const counts = await (await mongoCollection('community_post_comments')).aggregate([
    { $match: { post_id: postId, parent_id: { $in: visible.map((item) => item._id) }, status: { $in: ['active', 'deleted'] } } },
    { $group: { _id: '$parent_id', count: { $sum: 1 } } },
  ]).toArray();
  const countById = new Map(counts.map((entry) => [entry._id, entry.count]));
  const votes = req.user ? await (await mongoCollection('community_comment_votes')).find({ user_id: req.user.id, comment_id: { $in: visible.map((item) => item._id) } }, { projection: { comment_id: 1, value: 1 } }).toArray() : [];
  const voteById = new Map(votes.map((entry) => [entry.comment_id, entry.value]));
  const voteCounts = await (await mongoCollection('community_comment_votes')).aggregate([
    { $match: { comment_id: { $in: visible.map((item) => item._id) } } },
    { $group: { _id: '$comment_id', upvotes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } }, downvotes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } } } },
  ]).toArray();
  const votesById = new Map(voteCounts.map((entry) => [entry._id, entry]));
  res.json({ items: visible.map((item) => ({ ...item, author: byId.get(item.author_id) || null, viewer_vote: voteById.get(item._id) || 0, reply_count: countById.get(item._id) || 0, upvotes: votesById.get(item._id)?.upvotes || 0, downvotes: votesById.get(item._id)?.downvotes || 0 })), page, hasMore: items.length > 20 });
}));
postsRouter.put('/:id/comments/:commentId/vote', requireAuth, asyncHandler(async (req, res) => {
  const postId = parsePositiveInt(req.params.id);
  const commentId = parsePositiveInt(req.params.commentId);
  const value = req.body?.value;
  if (![0, 1, -1].includes(value) || Object.keys(req.body).some((key) => key !== 'value')) throw bad('Vote must be -1, 0 or 1');
  const visibility = await visibleTo(req.user);
  const result = await withMongoTransaction(async (session) => {
    const posts = await mongoCollection('community_posts');
    const comments = await mongoCollection('community_post_comments');
    const votes = await mongoCollection('community_comment_votes');
    if (!await posts.findOne({ _id: postId, status: 'active', ...visibility }, { session })) return null;
    const comment = await comments.findOne({ _id: commentId, post_id: postId, status: 'active' }, { session });
    if (!comment) return null;
    const previous = await votes.findOne({ comment_id: commentId, user_id: req.user.id }, { session });
    const voteId = previous?._id ?? `${commentId}:${req.user.id}`;
    const old = previous?.value || 0;
    if (value === 0) await votes.deleteOne({ _id: voteId }, { session });
    else await votes.updateOne({ _id: voteId }, { $set: { value }, $setOnInsert: { comment_id: commentId, user_id: req.user.id } }, { upsert: true, session });
    const updated = await comments.findOneAndUpdate({ _id: commentId, post_id: postId, status: 'active' }, { $inc: { score: value - old } }, { session, returnDocument: 'after' });
    if (!updated) return null;
    const upvotes = await votes.countDocuments({ comment_id: commentId, value: 1 }, { session });
    const downvotes = await votes.countDocuments({ comment_id: commentId, value: -1 }, { session });
    return { score: updated.score, value, upvotes, downvotes };
  });
  if (!result) return res.status(404).json({ message: 'Comment not found' });
  res.json(result);
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
  if (isScene(req)) return res.status(404).json({ message: 'Not found' });
  await (await mongoCollection('community_saved_posts')).deleteOne({ user_id: req.user.id, post_id: parsePositiveInt(req.params.id) });
  res.status(204).end();
}));
const reportLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: 'draft-7', legacyHeaders: false });
postsRouter.post('/:id/reports', requireAuth, reportLimiter, asyncHandler(async (req, res) => {
  if (!isScene(req)) return res.status(404).json({ message: 'Not found' });
  const postId = parsePositiveInt(req.params.id);
  const { reason, description = '' } = req.body || {};
  if (!['spam', 'harassment', 'spoiler', 'other'].includes(reason) || typeof description !== 'string' || description.length > 1000 || Object.keys(req.body || {}).some((key) => !['reason', 'description'].includes(key))) throw bad('Invalid report');
  if (!await (await mongoCollection('community_posts')).findOne({ _id: postId, status: 'active', content_type: 'scene_question', ...await visibleTo(req.user) })) return res.status(404).json({ message: 'Post not found' });
  try { await (await mongoCollection('community_reports')).insertOne({ _id: `scene-question:${postId}:${req.user.id}`, reporter_id: req.user.id, target_type: 'post', target_id: postId, reason, description: description.trim(), status: 'open', created_at: new Date() }); }
  catch (error) { if (error.code === 11000) return res.status(409).json({ message: 'Already reported' }); throw error; }
  res.status(201).json({ message: 'Report submitted' });
}));
postsRouter.post('/:id/comments/:commentId/reports', requireAuth, reportLimiter, asyncHandler(async (req, res) => {
  if (!isScene(req)) return res.status(404).json({ message: 'Not found' });
  const postId = parsePositiveInt(req.params.id), commentId = parsePositiveInt(req.params.commentId);
  const { reason, description = '' } = req.body || {};
  if (!['spam', 'harassment', 'spoiler', 'other'].includes(reason) || typeof description !== 'string' || description.length > 1000 || Object.keys(req.body || {}).some((key) => !['reason', 'description'].includes(key))) throw bad('Invalid report');
  if (!await (await mongoCollection('community_posts')).findOne({ _id: postId, status: 'active', content_type: 'scene_question', ...await visibleTo(req.user) }) || !await (await mongoCollection('community_post_comments')).findOne({ _id: commentId, post_id: postId, status: 'active' })) return res.status(404).json({ message: 'Comment not found' });
  try { await (await mongoCollection('community_reports')).insertOne({ _id: `scene-comment:${commentId}:${req.user.id}`, reporter_id: req.user.id, target_type: 'comment', target_id: commentId, comment_source: 'scene', post_id: postId, reason, description: description.trim(), status: 'open', created_at: new Date() }); }
  catch (error) { if (error.code === 11000) return res.status(409).json({ message: 'Already reported' }); throw error; }
  res.status(201).json({ message: 'Report submitted' });
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
