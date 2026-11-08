import { mongoCollection } from '../../core/database/mongo.js';
import { createNotification } from './notification.service.js';

// Historical expirations must not generate a backlog on rollout.
const notificationStart = new Date('2026-11-08T00:00:00.000Z');
const day = 86400000;

const processReminder = async (users, now, days, lowerBound) => {
  const expiryLimit = new Date(now.getTime() + days * day);
  const marker = `vip_reminder_${days}_expiry`;
  const candidates = await users.find({ status: 'active', vip_expires_at: { $gt: lowerBound, $lte: expiryLimit },
    $expr: { $ne: [`$${marker}`, '$vip_expires_at'] } },
  { projection: { id: 1, vip_expires_at: 1, notification_preferences: 1 } }).sort({ vip_expires_at: 1 }).limit(200).toArray();
  if (!candidates.length) return;
  const subscriptions = await (await mongoCollection('user_subscriptions')).find({
    user_id: { $in: candidates.map((user) => user.id) }, status: 'active',
    end_date: { $in: candidates.map((user) => user.vip_expires_at) },
  }, { projection: { id: 1, user_id: 1, end_date: 1 } }).toArray();
  const current = new Map(subscriptions.map((item) => [`${item.user_id}:${new Date(item.end_date).getTime()}`, item]));
  for (const user of candidates) {
    const expiresAt = new Date(user.vip_expires_at);
    const subscription = current.get(`${user.id}:${expiresAt.getTime()}`);
    // A cancelled or legacy subscription is not a reliable reminder source.
    if (subscription) {
      await createNotification({ recipientId: user.id, type: 'vip_reminder',
        title: days === 7 ? 'VIP sắp hết hạn sau 7 ngày' : 'VIP sẽ hết hạn vào ngày mai',
        message: days === 7 ? 'Gói VIP của bạn sẽ hết hạn trong vòng 7 ngày.' : 'Gói VIP của bạn sẽ hết hạn trong vòng 1 ngày.',
        entityType: 'user', entityId: user.id, redirectUrl: '/settings?tab=profile',
        metadata: { daysRemaining: days, expiresAt: expiresAt.toISOString() },
        deduplicationKey: `vip-reminder:${user.id}:${subscription.id}:${expiresAt.getTime()}:${days}`,
        preferences: { vip_reminders: user.notification_preferences?.vip_reminders !== false } });
    }
    await users.updateOne({ id: user.id, vip_expires_at: user.vip_expires_at }, { $set: { [marker]: user.vip_expires_at } });
  }
};

export const processExpiredVipNotifications = async () => {
  const users = await mongoCollection('users');
  await users.createIndex({ vip_expires_at: 1, status: 1 });
  const now = new Date();
  // Delayed runs still catch a milestone until the next, closer milestone.
  await processReminder(users, now, 7, new Date(now.getTime() + day));
  await processReminder(users, now, 1, now);
  const cursor = users.find({ status: 'active', vip_expires_at: { $gte: notificationStart, $lte: now },
    $expr: { $ne: ['$vip_expiry_notified_at', '$vip_expires_at'] } },
  { projection: { id: 1, vip_expires_at: 1 } }).sort({ vip_expires_at: 1 }).limit(200);
  for await (const user of cursor) {
    const expiresAt = new Date(user.vip_expires_at);
    await createNotification({ recipientId: user.id, type: 'vip_expired', title: 'Quyền VIP đã hết hạn',
      message: 'Quyền VIP của bạn đã hết hạn. Liên hệ quản trị viên nếu cần gia hạn.',
      entityType: 'user', entityId: user.id, redirectUrl: '/settings?tab=profile',
      deduplicationKey: `vip-expired:${user.id}:${expiresAt.getTime()}` });
    await users.updateOne({ id: user.id, vip_expires_at: user.vip_expires_at },
      { $set: { vip_expiry_notified_at: user.vip_expires_at } });
  }
};
