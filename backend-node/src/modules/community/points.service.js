import { mongoCollection, withMongoTransaction, nextNumericId } from '../../core/database/mongo.js';
import { createNotification, emitStoredNotification, ensureNotificationIndexes } from './notification.service.js';
import { createHash } from 'node:crypto';

export const RULES = Object.freeze({ post: { points: 10, daily: 3 }, review: { points: 15, daily: 2 }, comment: { points: 3, daily: 10 }, answer: { points: 5, daily: 5 }, upvote: { points: 2, daily: 30 }, milestone: { points: 20, daily: null }, report: { points: 5, daily: 3 } });
export const REWARDS = Object.freeze([{ rank: 1, days: 30, min: 800 }, { rank: 2, days: 15, min: 500 }, { rank: 3, days: 7, min: 300 }]);
export const pointConfig = async (session) => {
  const record = await (await mongoCollection('point_settings')).findOne({ _id: 'current' }, session ? { session } : undefined);
  return { rules: record?.rules || RULES, rewards: record?.rewards || REWARDS, autoApprove: false };
};
export const monthKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(date).slice(0, 7);
export const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export const meaningfulContent = (content, minLength, minWords) => typeof content === 'string' && content.trim().length >= minLength && new Set((content.toLocaleLowerCase('vi-VN').match(/[\p{L}\p{N}]+/gu) || []).filter((word) => word.length > 1)).size >= minWords;
export const monthBounds = (month) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Object.assign(new Error('Invalid month'), { status: 400 });
  const [year, value] = month.split('-').map(Number);
  return [new Date(Date.UTC(year, value - 1, 1, -7)), new Date(Date.UTC(year, value, 1, -7))];
};
let indexes;
export const ensurePointIndexes = () => indexes ||= (async () => {
  const tx = await mongoCollection('point_transactions');
  await tx.createIndex({ idempotencyKey: 1 }, { unique: true });
  await tx.createIndex({ userId: 1, createdAt: -1 });
  await tx.createIndex({ month: 1, userId: 1, createdAt: 1 });
  await tx.createIndex({ sourceType: 1, sourceId: 1 });
  await tx.createIndex({ reverses: 1 }, { partialFilterExpression: { reverses: { $type: 'string' } } });
  await (await mongoCollection('monthly_leaderboards')).createIndex({ month: 1 }, { unique: true });
  await (await mongoCollection('monthly_vip_rewards')).createIndex({ month: 1, userId: 1 }, { unique: true });
  await (await mongoCollection('subscription_plans')).createIndex({ reward_duration_days: 1 }, { unique: true, partialFilterExpression: { reward_duration_days: { $type: 'number' } } });
  await (await mongoCollection('user_subscriptions')).createIndex({ source: 1, source_id: 1 }, { unique: true, partialFilterExpression: { source: 'monthly_reward' } });
})().catch((error) => { indexes = undefined; throw error; });

// The quota document is updated in the same Mongo transaction as the source and ledger.
// A unique ledger key prevents retries; the quota write serializes competing awards.
export async function awardPoint({ userId, type, sourceType, sourceId, actorId, content, at = new Date(), session }) {
  if (!RULES[type] || !Number.isSafeInteger(userId) || !Number.isSafeInteger(sourceId)) throw new Error('Invalid point event');
  const key = `${type}:${sourceType}:${sourceId}:${actorId ?? userId}`;
  const tx = await mongoCollection('point_transactions');
  if (await tx.findOne({ idempotencyKey: key }, { session, projection: { _id: 1 } })) return false;
  const rule = (await pointConfig(session)).rules[type], day = dayKey(at), month = monthKey(at);
  if (content) {
    const normalized = content.toLocaleLowerCase('vi-VN').trim().replace(/\s+/g, ' ');
    const fingerprint = createHash('sha256').update(`${userId}:${type}:${day}:${normalized}`).digest('hex');
    const unique = await (await mongoCollection('point_content_fingerprints')).updateOne({ _id: fingerprint }, { $setOnInsert: { userId, type, day, sourceId, createdAt: at } }, { upsert: true, session });
    if (!unique.upsertedCount) return false;
  }
  if (rule.daily) {
    const quotas = await mongoCollection('point_daily_quotas');
    const quotaId = `${userId}:${type}:${day}`;
    await quotas.updateOne({ _id: quotaId }, { $setOnInsert: { userId, type, day, count: 0 } }, { upsert: true, session });
    const quota = await quotas.findOneAndUpdate({ _id: quotaId, count: { $lt: rule.daily } }, { $inc: { count: 1 } }, { session, returnDocument: 'after' });
    if (!quota) return false;
  }
  await tx.insertOne({ _id: key, idempotencyKey: key, userId, type, sourceType, sourceId, actorId: actorId ?? null, points: rule.points, month, day, createdAt: at }, { session });
  if (type === 'upvote' && actorId !== userId) {
    const repeated = await tx.countDocuments({ userId, actorId, type: 'upvote', day }, { session });
    if (repeated >= 5) await (await mongoCollection('point_review_flags')).updateOne({ _id: `repeat-vote:${day}:${actorId}:${userId}` }, { $setOnInsert: { userId, actorId, day, reason: 'repeated_upvotes_same_recipient', status: 'open', createdAt: at } }, { upsert: true, session });
    const hour = new Date(at.getTime() - 3600000);
    const burst = await tx.countDocuments({ userId, type: 'upvote', createdAt: { $gte: hour, $lte: at } }, { session });
    if (burst >= 15) await (await mongoCollection('point_review_flags')).updateOne({ _id: `upvote-burst:${day}:${userId}` }, { $setOnInsert: { userId, actorId: null, day, reason: 'many_upvotes_in_one_hour', status: 'open', createdAt: at } }, { upsert: true, session });
  }
  return true;
}

// Quest rewards use the same ledger, month attribution and unique key as activity points.
export async function awardQuestPoint({ userId, questId, period, points, session, at = new Date() }) {
  const key = `quest:${questId}:${period}:${userId}`;
  const tx = await mongoCollection('point_transactions');
  const result = await tx.updateOne({ _id: key }, { $setOnInsert: {
    _id: key, idempotencyKey: key, userId, type: 'quest', sourceType: 'quest', sourceId: key,
    actorId: null, points, month: monthKey(at), day: dayKey(at), createdAt: at,
  } }, { upsert: true, session });
  return result.upsertedCount === 1;
}

export async function reversePoints({ sourceType, sourceId, actorId, session, at = new Date() }) {
  const tx = await mongoCollection('point_transactions');
  const originals = await tx.find({ sourceType, sourceId, ...(actorId !== undefined && { actorId }), points: { $gt: 0 } }, { session }).toArray();
  for (const item of originals) {
    // Serialize a source reversal with a concurrent quest claim that uses this event.
    if (item.type !== 'quest') await tx.updateOne({ _id: item._id }, { $inc: { questSerial: 1 } }, { session });
    const key = `reverse:${item.idempotencyKey}`;
    const reversed = await tx.updateOne({ _id: key }, { $setOnInsert: { _id: key, idempotencyKey: key, userId: item.userId, type: 'reversal', sourceType, sourceId, actorId: null, points: -item.points, month: item.month, day: dayKey(at), createdAt: at, reverses: item.idempotencyKey } }, { upsert: true, session });
    if (reversed.upsertedCount && item.type !== 'quest') {
      const claims = await mongoCollection('quest_claims');
      for (const claim of await claims.find({ userId: item.userId, status: 'claimed', evidenceKeys: item.idempotencyKey }, { session }).toArray()) {
        const changed = await claims.updateOne({ _id: claim._id, status: 'claimed' }, { $set: { status: 'revoked', revokedAt: at, revokedBy: item.idempotencyKey } }, { session });
        if (changed.modifiedCount) await reversePoints({ sourceType: 'quest', sourceId: claim._id, session, at });
      }
    }
  }
}

export async function leaderboard(month, viewerId) {
  await ensurePointIndexes();
  const snapshot = await (await mongoCollection('monthly_leaderboards')).findOne({ month });
  if (snapshot) return { month, closed: true, top: snapshot.rows.slice(0, 100), me: snapshot.rows.find((row) => row.userId === viewerId) || null, rewards: snapshot.rewardRules || REWARDS };
  const tx = await mongoCollection('point_transactions');
  const totals = await tx.aggregate([{ $match: { month } }, { $group: { _id: '$userId', points: { $sum: '$points' } } }, { $match: { points: { $gt: 0 } } }]).toArray();
  const targets = new Map(totals.map((item) => [item._id, item]));
  const running = new Map();
  for await (const item of tx.find({ month, userId: { $in: totals.map((row) => row._id) } }, { projection: { userId: 1, points: 1, createdAt: 1 } }).sort({ createdAt: 1, _id: 1 })) {
    const sum = (running.get(item.userId) || 0) + item.points;
    running.set(item.userId, sum);
    const target = targets.get(item.userId);
    if (!target.reachedAt && sum >= target.points) target.reachedAt = item.createdAt;
  }
  const users = await (await mongoCollection('users')).find({ id: { $in: totals.map((row) => row._id) } }, { projection: { _id: 0, id: 1, username: 1, avatar_url: 1, status: 1, fraud_confirmed: 1, moderation_locked_until: 1 } }).toArray();
  const byId = new Map(users.map((user) => [user.id, user]));
  const rows = totals.filter((row) => byId.get(row._id)?.status === 'active').map((row) => ({ userId: row._id, username: byId.get(row._id).username, avatarUrl: byId.get(row._id).avatar_url || null, points: row.points, reachedAt: row.reachedAt, rewardEligible: !byId.get(row._id).fraud_confirmed && !(new Date(byId.get(row._id).moderation_locked_until || 0) > new Date()) })).sort((a, b) => b.points - a.points || +new Date(a.reachedAt) - +new Date(b.reachedAt) || a.userId - b.userId).map((row, index) => ({ ...row, rank: index + 1 }));
  return { month, closed: false, top: rows.slice(0, 100), me: rows.find((row) => row.userId === viewerId) || null, rows };
}

export async function closeMonth(month) {
  const [, end] = monthBounds(month);
  if (end > new Date()) throw Object.assign(new Error('Month has not ended in Vietnam'), { status: 400 });
  await ensurePointIndexes();
  const board = await leaderboard(month);
  if (board.closed) return board;
  const config = await pointConfig();
  await withMongoTransaction(async (session) => {
    await (await mongoCollection('monthly_leaderboards')).updateOne({ month }, { $setOnInsert: { month, rows: board.rows, rewardRules: config.rewards, closedAt: new Date(), status: 'pending_review' } }, { upsert: true, session });
    for (const row of board.rows.slice(0, 10)) {
      const vip = config.rewards.find((reward) => reward.rank === row.rank && row.points >= reward.min);
      if (!vip && row.rank <= 3) continue;
      await (await mongoCollection('monthly_vip_rewards')).updateOne({ month, userId: row.userId }, { $setOnInsert: { month, userId: row.userId, rank: row.rank, points: row.points, kind: vip ? 'vip' : 'badge', days: vip?.days || 0, status: row.rewardEligible ? 'pending_review' : 'excluded', history: [], createdAt: new Date() } }, { upsert: true, session });
    }
  });
  return leaderboard(month);
}

export async function approveReward(month, userId, adminId, decision, reason) {
  await ensurePointIndexes(); await ensureNotificationIndexes();
  let result;
  try { result = await withMongoTransaction(async (session) => {
    const rewards = await mongoCollection('monthly_vip_rewards');
    const reward = await rewards.findOne({ month, userId, status: 'pending_review' }, { session });
    if (!reward) return null;
    const now = new Date();
    if (decision === 'exclude') {
      await rewards.updateOne({ month, userId, status: 'pending_review' }, { $set: { status: 'excluded' }, $push: { history: { action: 'excluded', actorId: adminId, reason, at: now } } }, { session });
      return { status: 'excluded' };
    }
    const eligible = await (await mongoCollection('users')).findOne({ id: userId, status: 'active', fraud_confirmed: { $ne: true }, $or: [{ moderation_locked_until: null }, { moderation_locked_until: { $lte: new Date() } }] }, { session });
    if (!eligible) throw Object.assign(new Error('User is not eligible'), { status: 409 });
    let endDate = null;
    if (reward.kind === 'vip') {
      const users = await mongoCollection('users');
      const user = eligible;
      const previous = user.vip_expires_at && new Date(user.vip_expires_at) > now ? new Date(user.vip_expires_at) : now;
      endDate = new Date(previous.getTime() + reward.days * 86400000);
      const plans = await mongoCollection('subscription_plans');
      let plan = await plans.findOne({ reward_duration_days: reward.days }, { session });
      if (!plan) plan = await plans.findOne({ duration_days: reward.days, is_active: { $in: [1, true] } }, { session });
      if (!plan) {
        const planId = await nextNumericId('subscription_plans');
        plan = { _id: planId, id: planId, name: `ZFLIX Points VIP ${reward.days} days`, duration_days: reward.days, reward_duration_days: reward.days, price: 0, discount_price: 0, is_active: 0, created_at: now };
        await plans.insertOne(plan, { session });
      }
      const id = await nextNumericId('user_subscriptions');
      await (await mongoCollection('user_subscriptions')).insertOne({ _id: id, id, user_id: userId, plan_id: plan.id, transaction_id: null, source: 'monthly_reward', source_id: `${month}:${userId}`, start_date: previous, end_date: endDate, status: 'active', auto_renew: 0, created_at: now }, { session });
      const changed = await users.updateOne({ id: userId, status: 'active', vip_expires_at: user.vip_expires_at ?? null }, { $set: { vip_expires_at: endDate } }, { session });
      if (!changed.matchedCount) throw new Error('VIP entitlement changed during approval');
    }
    await rewards.updateOne({ month, userId, status: 'pending_review' }, { $set: { status: 'granted', grantedAt: now, vipExpiresAt: endDate }, $push: { history: { action: 'approved', actorId: adminId, reason, at: now } } }, { session });
    const notification = await createNotification({ recipientId: userId, type: 'vip', title: reward.kind === 'vip' ? 'Bạn đã nhận VIP tháng' : 'Bạn đã nhận huy hiệu Top 10 tháng', message: reward.kind === 'vip' ? `Top ${reward.rank} tháng ${month}: VIP ${reward.days} ngày.` : `Top ${reward.rank} tháng ${month}.`, entityType: 'monthly_reward', entityId: userId, redirectUrl: '/leaderboard', deduplicationKey: `monthly-reward:${month}:${userId}`, session });
    return { status: 'granted', notification };
  }); } catch (error) {
    console.error('Monthly reward approval failed', { month, userId, decision, error: error.message });
    try { await (await mongoCollection('monthly_vip_reward_logs')).insertOne({ month, userId, actorId: adminId, decision, status: 'failed', error: error.message, createdAt: new Date() }); }
    catch (logError) { console.error('Monthly reward failure log failed', logError); }
    throw error;
  }
  emitStoredNotification(result?.notification);
  return result;
}
