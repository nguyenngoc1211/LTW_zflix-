import { mongoCollection } from '../../core/database/mongo.js';
import { createNotification } from './notification.service.js';

// A mention is resolved once, when content is created. The stored IDs remain
// stable if an account later changes its display name.
export const mentionNames = (content) => [...new Set(
  [...String(content || '').matchAll(/(^|[^\w])@([A-Za-z0-9_]{3,50})(?!\w)/g)]
    .map((match) => match[2]),
) ].slice(0, 20);

export const resolveMentions = async (content, session) => {
  const names = mentionNames(content);
  if (!names.length) return [];
  const users = await (await mongoCollection('users')).find({
    username: { $in: names }, status: 'active',
  }, { session, projection: { id: 1, username: 1 } }).toArray();
  return [...new Map(users
    .map((user) => [user.id, { id: user.id, username: user.username }])).values()];
};

export const notifyMentions = async ({ recipients, actor, contentId, contentType, redirectUrl,
  excerpt, excludedRecipientId, session }) => {
  const records = [];
  for (const user of recipients) {
    if (user.id === actor.id || user.id === excludedRecipientId) continue;
    const record = await createNotification({ recipientId: user.id, actorId: actor.id,
      type: 'mention', title: `${actor.username} đã nhắc đến bạn`, message: excerpt.slice(0, 120),
      entityType: contentType, entityId: contentId, redirectUrl,
      metadata: { actorAvatar: actor.avatar_url || null, mentionedUserId: user.id },
      deduplicationKey: `mention:${contentType}:${contentId}:recipient:${user.id}`, session });
    if (record) records.push(record);
  }
  return records;
};
