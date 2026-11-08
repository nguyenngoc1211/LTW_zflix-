import { mongoCollection, nextNumericId } from '../../core/database/mongo.js';
import { allowsNotification } from './notification-preferences.js';

let notificationNamespace;
export const setNotificationNamespace = (namespace) => { notificationNamespace = namespace; };
export const emitStoredNotification = (record) => {
  if (record) notificationNamespace?.to(`user:${record.user_id}`).emit('notification:new', { ...record, _id: undefined });
};
export const emitNotificationRefresh = (userId) => {
  if (userId) notificationNamespace?.to(`user:${userId}`).emit('notification:changed');
};

let indexPromise;
export const ensureNotificationIndexes = () => indexPromise ||= (async () => {
  const collection = await mongoCollection('notifications');
  await collection.createIndex({ user_id: 1, created_at: -1 });
  await collection.createIndex({ user_id: 1, is_read: 1, created_at: -1 });
  await collection.createIndex({ deduplication_key: 1 }, { unique: true, partialFilterExpression: { deduplication_key: { $type: 'string' } } });
})().catch((error) => { indexPromise = undefined; throw error; });

export const createNotification = async ({ recipientId, actorId = null, type, title, message, entityType, entityId, redirectUrl, deduplicationKey, metadata = {}, session, preferences }) => {
  if (!Number.isSafeInteger(recipientId) || recipientId <= 0 || !deduplicationKey) throw new Error('Invalid notification');
  if (!await allowsNotification(recipientId, type, session, preferences)) return null;
  if (!session) await ensureNotificationIndexes();
  const collection = await mongoCollection('notifications');
  const id = await nextNumericId('notifications');
  const record = { _id: id, id, user_id: recipientId, actor_id: actorId, type, title, message,
    entity_type: entityType, entity_id: entityId, redirect_url: redirectUrl, metadata,
    is_read: 0, read_at: null, created_at: new Date(), deduplication_key: deduplicationKey };
  try { await collection.insertOne(record, session ? { session } : undefined); }
  catch (error) {
    if (error.code === 11000 && await collection.findOne({ deduplication_key: deduplicationKey })) return null;
    throw error;
  }
  if (!session) emitStoredNotification(record);
  return record;
};

export const directCommentRecipient = ({ parentId, parentAuthorId, postAuthorId, actorId }) => {
  const recipient = parentId ? parentAuthorId : postAuthorId;
  return Number.isSafeInteger(recipient) && recipient > 0 && recipient !== actorId ? recipient : null;
};

export const notifyComment = async ({ recipientId, actor, commentId, parentId, postId, productionId, postTitle, content, scene = false, session }) => {
  if (!directCommentRecipient({ parentId, parentAuthorId: recipientId, postAuthorId: recipientId, actorId: actor.id })) return null;
  const post = Boolean(postId);
  return createNotification({ recipientId, actorId: actor.id,
    type: parentId ? 'comment_reply' : 'post_comment',
    title: parentId ? `${actor.username} đã trả lời bình luận của bạn` : `${actor.username} đã bình luận bài viết`,
    message: post ? `${postTitle || 'Bài viết'}: ${content.slice(0, 120)}` : content.slice(0, 120),
    entityType: post ? 'post_comment' : 'comment', entityId: commentId,
    redirectUrl: post ? `/community/${scene ? 'scene-questions' : 'posts'}/${postId}?commentId=${commentId}` : `/movies/${productionId}?commentId=${commentId}`,
    metadata: { actorAvatar: actor.avatar_url || null, postId, productionId, parentId },
    deduplicationKey: `${post ? 'post' : 'movie'}-comment:${commentId}:recipient:${recipientId}`, session });
};

export const listNotifications = async (userId, { page = 1, limit = 20, filter = 'all' } = {}) => {
  const collection = await mongoCollection('notifications');
  const query = { user_id: userId };
  if (filter === 'unread') query.is_read = { $in: [0, false] };
  if (filter === 'movie') query.type = 'new_episode';
  if (filter === 'comment') query.type = { $in: ['comment_reply', 'post_comment', 'mention', 'like'] };
  if (filter === 'system') query.type = { $nin: ['new_episode', 'comment_reply', 'post_comment', 'mention', 'like'] };
  const [items, total, unread] = await Promise.all([
    collection.find(query, { projection: { _id: 0 } }).sort({ created_at: -1, id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    collection.countDocuments(query), collection.countDocuments({ user_id: userId, is_read: { $in: [0, false] } }),
  ]);
  return { items, total, unread, page, limit, hasMore: page * limit < total };
};
