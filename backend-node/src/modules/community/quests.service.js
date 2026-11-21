import { mongoCollection, withMongoTransaction } from '../../core/database/mongo.js';
import { awardQuestPoint, dayKey, ensurePointIndexes } from './points.service.js';
import { createNotification, emitStoredNotification, ensureNotificationIndexes } from './notification.service.js';

const ACTIONS = ['post', 'review', 'comment', 'upvote'];
const START = new Date('2026-11-20T17:00:00.000Z'); // Launch day in Vietnam.
export const DEFAULT_QUESTS = [
  { id: 'daily_post', title: 'Đăng một bài viết', cadence: 'daily', action: 'post', target: 1, points: 5 },
  { id: 'daily_review', title: 'Viết một review phim', cadence: 'daily', action: 'review', target: 1, points: 8 },
  { id: 'daily_comments', title: 'Thảo luận cùng cộng đồng', cadence: 'daily', action: 'comment', target: 3, points: 5 },
  { id: 'daily_upvotes', title: 'Nhận 5 lượt thích hợp lệ', cadence: 'daily', action: 'upvote', target: 5, points: 7 },
  { id: 'weekly_posts', title: 'Chia sẻ 3 bài trong tuần', cadence: 'weekly', action: 'post', target: 3, points: 15 },
  { id: 'weekly_reviews', title: 'Viết 4 review trong tuần', cadence: 'weekly', action: 'review', target: 4, points: 20 },
  { id: 'weekly_comments', title: 'Góp 15 bình luận trong tuần', cadence: 'weekly', action: 'comment', target: 15, points: 15 },
  { id: 'weekly_upvotes', title: 'Nhận 20 lượt thích trong tuần', cadence: 'weekly', action: 'upvote', target: 20, points: 20 },
];
export const DEFAULT_ACHIEVEMENTS = [
  { id: 'first_post', title: 'Ngòi bút đầu tiên', description: 'Đăng bài viết hợp lệ đầu tiên', action: 'post', target: 1, icon: '✦' },
  { id: 'ten_reviews', title: 'Nhà phê bình', description: 'Viết 10 review phim hợp lệ', action: 'review', target: 10, icon: '★' },
  { id: 'hundred_upvotes', title: 'Tiếng nói cộng đồng', description: 'Nhận 100 upvote hợp lệ', action: 'upvote', target: 100, icon: '◆' },
  { id: 'monthly_top_ten', title: 'Top 10 tháng', description: 'Nhận giải Top 10 tháng', action: 'top10', target: 1, icon: '♛' },
];

let indexes;
export const ensureQuestIndexes = () => indexes ||= (async () => {
  await ensurePointIndexes();
  await (await mongoCollection('quest_claims')).createIndex({ userId: 1, claimedAt: -1 });
  await (await mongoCollection('quest_claims')).createIndex({ userId: 1, status: 1, evidenceKeys: 1 });
})().catch((error) => { indexes = undefined; throw error; });

const errorWith = (message, status = 400) => Object.assign(new Error(message), { status });
const activeDefinitions = async (collection, defaults, session) => {
  const changes = await (await mongoCollection(collection)).find({}, { session }).toArray();
  const byId = new Map(defaults.map((item) => [item.id, { ...item, enabled: true, activeFrom: START }]));
  for (const item of changes) byId.set(item.id, { ...item, activeFrom: item.activeFrom || START });
  return [...byId.values()].filter((item) => item.enabled !== false);
};
export const questDefinitions = (session) => activeDefinitions('quest_definitions', DEFAULT_QUESTS, session);
export const achievementDefinitions = (session) => activeDefinitions('achievement_definitions', DEFAULT_ACHIEVEMENTS, session);

export function periodFor(cadence, at = new Date()) {
  const today = dayKey(at);
  if (cadence === 'daily') {
    const start = new Date(`${today}T00:00:00+07:00`);
    return { key: today, start, end: new Date(start.getTime() + 86400000) };
  }
  if (cadence !== 'weekly') throw errorWith('Invalid quest cadence');
  const noon = new Date(`${today}T12:00:00+07:00`);
  const monday = new Date(noon.getTime() - ((noon.getUTCDay() + 6) % 7) * 86400000);
  const key = dayKey(monday);
  const start = new Date(`${key}T00:00:00+07:00`);
  return { key, start, end: new Date(start.getTime() + 7 * 86400000) };
}

// Only activity transactions produced by Points count; reversal keys invalidate them.
async function validEvents(userId, types, start, end, session) {
  const tx = await mongoCollection('point_transactions');
  const match = { userId, type: { $in: types }, points: { $gt: 0 } };
  if (start || end) match.createdAt = { ...(start && { $gte: start }), ...(end && { $lt: end }) };
  return tx.aggregate([
    { $match: match },
    { $lookup: { from: 'point_transactions', localField: 'idempotencyKey', foreignField: 'reverses', as: 'reversal' } },
    { $match: { reversal: { $size: 0 } } },
    { $project: { _id: 0, idempotencyKey: 1, type: 1, createdAt: 1 } },
    { $sort: { createdAt: 1, idempotencyKey: 1 } },
  ], session ? { session } : undefined).toArray();
}

export async function questStatus(userId, at = new Date()) {
  await ensureQuestIndexes();
  const quests = await questDefinitions();
  const day = periodFor('daily', at), week = periodFor('weekly', at);
  const [events, claims] = await Promise.all([
    validEvents(userId, ACTIONS, week.start, week.end),
    (await mongoCollection('quest_claims')).find({ userId, period: { $in: [day.key, week.key] } }, { projection: { _id: 0, questId: 1, period: 1, status: 1, claimedAt: 1 } }).toArray(),
  ]);
  const claimed = new Map(claims.map((item) => [`${item.questId}:${item.period}`, item]));
  return { timezone: 'Asia/Ho_Chi_Minh', dailyEndsAt: day.end, weeklyEndsAt: week.end, quests: quests.map((quest) => {
    const period = quest.cadence === 'daily' ? day : week;
    const progress = events.filter((event) => event.type === quest.action && event.createdAt >= period.start && event.createdAt >= new Date(quest.activeFrom)).length;
    const claim = claimed.get(`${quest.id}:${period.key}`);
    return { id: quest.id, title: quest.title, cadence: quest.cadence, action: quest.action, target: quest.target, points: quest.points, progress: Math.min(progress, quest.target), completed: progress >= quest.target, claimed: claim?.status === 'claimed', revoked: claim?.status === 'revoked', period: period.key };
  }) };
}

export async function claimQuest(userId, questId, at = new Date()) {
  await ensureQuestIndexes(); await ensureNotificationIndexes();
  let result;
  try { result = await withMongoTransaction(async (session) => {
    const user = await (await mongoCollection('users')).findOne({ id: userId, status: 'active', fraud_confirmed: { $ne: true } }, { session, projection: { id: 1 } });
    if (!user) throw errorWith('Account is not eligible', 403);
    const quest = (await questDefinitions(session)).find((item) => item.id === questId);
    if (!quest) throw errorWith('Quest not found', 404);
    const period = periodFor(quest.cadence, at), claimId = `quest:${quest.id}:${period.key}:${userId}`;
    const claims = await mongoCollection('quest_claims');
    if (await claims.findOne({ _id: claimId }, { session })) throw errorWith('Quest reward already claimed', 409);
    const evidence = (await validEvents(userId, [quest.action], period.start, period.end, session)).filter((item) => item.createdAt >= new Date(quest.activeFrom)).slice(0, quest.target);
    if (evidence.length < quest.target) throw errorWith('Quest is not complete', 409);
    const tx = await mongoCollection('point_transactions');
    for (const event of evidence) await tx.updateOne({ idempotencyKey: event.idempotencyKey }, { $inc: { questSerial: 1 } }, { session });
    await claims.insertOne({ _id: claimId, userId, questId, period: period.key, cadence: quest.cadence, points: quest.points, evidenceKeys: evidence.map((item) => item.idempotencyKey), status: 'claimed', claimedAt: at }, { session });
    await awardQuestPoint({ userId, questId, period: period.key, points: quest.points, session, at });
    const notification = await createNotification({ recipientId: userId, type: 'system', title: 'Hoàn thành nhiệm vụ', message: `${quest.title}: +${quest.points} điểm`, entityType: 'quest', entityId: questId, redirectUrl: '/quests', deduplicationKey: claimId, session });
    return { questId, period: period.key, points: quest.points, notification };
  }); } catch (error) {
    if (error.code === 11000) throw errorWith('Quest reward already claimed', 409);
    throw error;
  }
  emitStoredNotification(result.notification);
  return { questId: result.questId, period: result.period, points: result.points };
}

export async function achievementStatus(userId) {
  await ensureQuestIndexes();
  const definitions = await achievementDefinitions();
  const [events, topTen] = await Promise.all([
    validEvents(userId, ACTIONS, START, null),
    (await mongoCollection('monthly_vip_rewards')).find({ userId, rank: { $lte: 10 }, status: 'granted' }, { projection: { grantedAt: 1 } }).toArray(),
  ]);
  return definitions.map((item) => {
    const progress = item.action === 'top10' ? topTen.filter((reward) => reward.grantedAt >= new Date(item.activeFrom)).length : events.filter((event) => event.type === item.action && event.createdAt >= new Date(item.activeFrom)).length;
    return { id: item.id, title: item.title, description: item.description, icon: item.icon, target: item.target, progress: Math.min(progress, item.target), earned: progress >= item.target };
  });
}

export const validateQuest = (item) => item && /^[a-z][a-z0-9_]{2,39}$/.test(item.id) && typeof item.title === 'string' && item.title.trim().length >= 5 && item.title.length <= 100 && ['daily', 'weekly'].includes(item.cadence) && ACTIONS.includes(item.action) && Number.isSafeInteger(item.target) && item.target >= 1 && item.target <= 100 && Number.isSafeInteger(item.points) && item.points >= 0 && item.points <= 100;
export const validateAchievement = (item) => item && /^[a-z][a-z0-9_]{2,39}$/.test(item.id) && typeof item.title === 'string' && item.title.trim().length >= 5 && item.title.length <= 100 && typeof item.description === 'string' && item.description.length <= 200 && typeof item.icon === 'string' && item.icon.length <= 8 && [...ACTIONS, 'top10'].includes(item.action) && Number.isSafeInteger(item.target) && item.target >= 1 && item.target <= 10000;
