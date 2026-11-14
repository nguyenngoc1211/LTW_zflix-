import { mongoCollection } from '../../core/database/mongo.js';

export const defaultNotificationPreferences = Object.freeze({
  episode_updates: true,
  comment_replies: true,
  post_comments: true,
  mentions: true,
  likes: true,
  vip_reminders: true,
});

const typePreference = {
  new_episode: 'episode_updates',
  comment_reply: 'comment_replies',
  post_comment: 'post_comments',
  mention: 'mentions',
  like: 'likes',
  vip_reminder: 'vip_reminders',
};

export const notificationPreferenceKey = (type) => typePreference[type] || null;

export const getNotificationPreferences = async (userId, session) => {
  const user = await (await mongoCollection('users')).findOne({ id: userId, status: 'active' },
    { projection: { notification_preferences: 1 }, ...(session && { session }) });
  if (!user) return null;
  return { ...defaultNotificationPreferences, ...user.notification_preferences };
};

export const allowsNotification = async (userId, type, session, knownPreferences) => {
  const key = notificationPreferenceKey(type);
  if (!key) return true;
  const preferences = knownPreferences || await getNotificationPreferences(userId, session);
  return preferences?.[key] === true;
};

export const validateNotificationPreferences = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !(key in defaultNotificationPreferences) || typeof body[key] !== 'boolean')) return null;
  return Object.fromEntries(keys.map((key) => [key, body[key]]));
};
