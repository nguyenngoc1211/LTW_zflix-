import { mongoCollection } from '../../core/database/mongo.js';
import { createNotification } from './notification.service.js';
import { allowsNotification } from './notification-preferences.js';

const cooldownMs = 24 * 60 * 60 * 1000;
const targetLabel = { post: 'bài viết', post_comment: 'bình luận', movie_comment: 'bình luận' };

export const notifyLike = async ({ recipientId, actor, targetType, targetId, redirectUrl, upvotes, session }) => {
  if (!recipientId || recipientId === actor.id || !await allowsNotification(recipientId, 'like', session)) return null;
  const now = new Date();
  const events = await mongoCollection('notification_like_events');
  const eventId = `${targetType}:${targetId}:actor:${actor.id}`;
  const previous = await events.findOne({ _id: eventId }, { session });
  if (previous && now - new Date(previous.last_notified_at) < cooldownMs) return null;
  await events.updateOne({ _id: eventId }, { $set: { last_notified_at: now },
    $setOnInsert: { actor_id: actor.id, target_type: targetType, target_id: targetId } }, { upsert: true, session });
  const key = `like:${targetType}:${targetId}:recipient:${recipientId}`;
  const collection = await mongoCollection('notifications');
  const existing = await collection.findOne({ deduplication_key: key }, { session });
  const label = targetLabel[targetType];
  const message = upvotes > 1 ? `${actor.username} và ${upvotes - 1} người khác đã thích ${label} của bạn.`
    : `${actor.username} đã thích ${label} của bạn.`;
  if (!existing) return createNotification({ recipientId, actorId: actor.id, type: 'like',
    title: 'Lượt thích mới', message, entityType: targetType, entityId: targetId,
    redirectUrl, metadata: { actorAvatar: actor.avatar_url || null, likeCount: upvotes },
    deduplicationKey: key, session });
  // A new actor changes the existing aggregate. Reopening a read item adds
  // exactly one unread notification; the collection never grows per liker.
  return collection.findOneAndUpdate({ _id: existing._id }, { $set: {
    actor_id: actor.id, message, 'metadata.actorAvatar': actor.avatar_url || null,
    'metadata.likeCount': upvotes, is_read: 0, read_at: null, created_at: now,
  } }, { session, returnDocument: 'after' });
};

export const syncLikeCount = async ({ recipientId, targetType, targetId, upvotes, session }) => {
  if (!recipientId) return null;
  const collection = await mongoCollection('notifications');
  const key = `like:${targetType}:${targetId}:recipient:${recipientId}`;
  if (upvotes === 0) {
    await collection.deleteOne({ deduplication_key: key }, { session });
    return null;
  }
  return collection.findOneAndUpdate({ deduplication_key: key },
    { $set: { 'metadata.likeCount': upvotes,
      message: `${upvotes} người đã thích ${targetLabel[targetType]} của bạn.` } },
    { session, returnDocument: 'after' });
};
