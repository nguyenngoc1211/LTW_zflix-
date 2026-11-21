import { config } from 'dotenv';
config({ path: '../.env' });
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';

const name = process.env.COMMUNITY_TEST_DB_NAME;
if (name !== 'community_test_schema_20261101' || !process.env.COMMUNITY_TEST_MONGODB_URI || name.toLowerCase() === process.env.MONGODB_DB_NAME?.toLowerCase()) throw new Error('Dedicated test DB required');
process.env.MONGODB_URI = process.env.COMMUNITY_TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = name;
process.env.DATA_STORE = 'mongodb';
const { ensurePointIndexes, awardPoint, reversePoints, leaderboard, closeMonth, approveReward, dayKey, monthKey } = await import('../src/modules/community/points.service.js');
const { withMongoTransaction, closeMongo } = await import('../src/core/database/mongo.js');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const ids = [2147482401, 2147482402, 2147482403, 2147482404];
const testMonth = '2019-07';
let originalPlanIds = [];
try {
  await client.connect();
  const db = client.db(name);
  assert.equal(db.databaseName, 'community_test_schema_20261101');
  await db.command({ ping: 1 });
  originalPlanIds = (await db.collection('subscription_plans').find({ reward_duration_days: { $in: [7, 15, 30] } }, { projection: { id: 1 } }).toArray()).map((plan) => plan.id);
  for (const id of ids) assert.equal(await db.collection('users').findOne({ id }), null, 'Fixture user exists');
  assert.equal(await db.collection('monthly_leaderboards').findOne({ month: testMonth }), null, 'Fixture month exists');
  await db.collection('users').insertMany(ids.map((id, index) => ({ _id: id, id, username: `points_smoke_${index}`, status: 'active', role: 'user', ...(index === 0 ? { vip_expires_at: new Date(Date.now() + 5 * 86400000) } : index === 1 ? { vip_expires_at: new Date('2018-01-01') } : {}) })));
  await ensurePointIndexes();
  assert.equal(dayKey(new Date('2026-10-31T16:59:59Z')), '2026-10-31');
  assert.equal(dayKey(new Date('2026-10-31T17:00:00Z')), '2026-11-01');
  assert.equal(monthKey(new Date('2026-10-31T17:00:00Z')), '2026-11');
  const at = new Date('2019-07-10T02:00:00Z');
  const award = (sourceId) => withMongoTransaction((session) => awardPoint({ userId: ids[0], type: 'post', sourceType: 'post', sourceId, at, session }));
  assert.equal(await award(2147482404), true);
  assert.equal(await award(2147482404), false);
  assert.equal(await award(2147482405), true);
  assert.equal(await award(2147482406), true);
  assert.equal(await award(2147482407), false, 'Daily cap');
  await withMongoTransaction((session) => reversePoints({ sourceType: 'post', sourceId: 2147482404, session }));
  await withMongoTransaction((session) => reversePoints({ sourceType: 'post', sourceId: 2147482404, session }));
  assert.equal(await db.collection('point_transactions').countDocuments({ userId: ids[0], type: 'reversal' }), 1);
  const competing = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => withMongoTransaction((session) => awardPoint({ userId: ids[1], type: 'comment', sourceType: 'post_comment', sourceId: 2147482410 + index, at, session }))));
  assert.equal(competing.filter((item) => item.status === 'fulfilled' && item.value).length, 10, 'Concurrent daily cap');
  assert.equal(await db.collection('point_transactions').countDocuments({ userId: ids[1], type: 'comment' }), 10);
  const duplicate = await Promise.allSettled(Array.from({ length: 3 }, () => withMongoTransaction((session) => awardPoint({ userId: ids[2], type: 'answer', sourceType: 'post_comment', sourceId: 2147482430, at, session }))));
  assert.equal(duplicate.filter((item) => item.status === 'fulfilled' && item.value).length, 1, 'Concurrent duplicate event');
  for (const [index, id] of ids.slice(1).entries()) {
    const key = `points-smoke-tie:${id}`;
    await db.collection('point_transactions').insertOne({ _id: key, idempotencyKey: key, userId: id, type: 'fixture', sourceType: 'fixture', sourceId: id, points: 50, month: '2019-06', createdAt: new Date(`2019-06-0${index + 1}T00:00:00Z`) });
  }
  assert.deepEqual((await leaderboard('2019-06')).top.map((item) => item.userId), ids.slice(1), 'Earlier score wins tie');
  for (const [index, points] of [900, 600, 350, 100].entries()) {
    const key = `points-smoke:${ids[index]}`;
    await db.collection('point_transactions').insertOne({ _id: key, idempotencyKey: key, userId: ids[index], type: 'fixture', sourceType: 'fixture', sourceId: ids[index], points, month: testMonth, createdAt: new Date(`2019-07-1${index}T00:00:00Z`) });
  }
  const live = await leaderboard(testMonth, ids[0]);
  assert.equal(live.top[0].userId, ids[0]);
  await closeMonth(testMonth);
  const closed = await leaderboard(testMonth, ids[0]);
  assert.equal(closed.closed, true);
  assert.equal(closed.top.length, 4);
  const before = await db.collection('users').findOne({ id: ids[0] });
  assert.equal((await approveReward(testMonth, ids[0], ids[2], 'approve', 'Verified clean activity')).status, 'granted');
  assert.equal(await approveReward(testMonth, ids[0], ids[2], 'approve', 'Repeated approval attempt'), null);
  const after = await db.collection('users').findOne({ id: ids[0] });
  assert.ok(new Date(after.vip_expires_at) > new Date(before.vip_expires_at));
  assert.equal(await db.collection('user_subscriptions').countDocuments({ source: 'monthly_reward', source_id: `${testMonth}:${ids[0]}` }), 1);
  await db.collection('users').updateOne({ id: ids[3] }, { $set: { fraud_confirmed: true } });
  await assert.rejects(approveReward(testMonth, ids[3], ids[0], 'approve', 'Pending fraud investigation'), /not eligible/);
  assert.equal((await db.collection('monthly_vip_rewards').findOne({ month: testMonth, userId: ids[3] })).status, 'pending_review');
  await db.collection('users').updateOne({ id: ids[3] }, { $set: { fraud_confirmed: false } });
  for (const id of ids.slice(1)) assert.equal((await approveReward(testMonth, id, ids[0], 'approve', 'Verified clean activity')).status, 'granted');
  const expired = await db.collection('users').findOne({ id: ids[1] });
  const fresh = await db.collection('users').findOne({ id: ids[2] });
  assert.ok(new Date(expired.vip_expires_at) > new Date());
  assert.ok(new Date(fresh.vip_expires_at) > new Date());
  assert.equal(await db.collection('user_subscriptions').countDocuments({ source: 'monthly_reward', source_id: { $in: ids.map((id) => `${testMonth}:${id}`) } }), 3);
  assert.equal((await db.collection('monthly_vip_rewards').findOne({ month: testMonth, userId: ids[3] })).kind, 'badge');
  assert.equal((await db.collection('users').findOne({ id: ids[3] })).vip_expires_at, undefined);
  console.log('Points smoke passed on', db.databaseName);
} finally {
  if (client.topology?.isConnected()) {
    const db = client.db(name);
    await db.collection('notifications').deleteMany({ deduplication_key: { $in: ids.map((id) => `monthly-reward:${testMonth}:${id}`) } });
    await db.collection('user_subscriptions').deleteMany({ source: 'monthly_reward', source_id: { $in: ids.map((id) => `${testMonth}:${id}`) } });
    await db.collection('subscription_plans').deleteMany({ reward_duration_days: { $in: [7, 15, 30] }, id: { $nin: originalPlanIds } });
    await db.collection('monthly_vip_rewards').deleteMany({ month: testMonth, userId: { $in: ids } });
    await db.collection('monthly_leaderboards').deleteOne({ month: testMonth });
    await db.collection('point_transactions').deleteMany({ userId: { $in: ids } });
    await db.collection('point_daily_quotas').deleteMany({ userId: { $in: ids } });
    await db.collection('monthly_vip_reward_logs').deleteMany({ month: testMonth, userId: { $in: ids } });
    await db.collection('point_content_fingerprints').deleteMany({ userId: { $in: ids } });
    await db.collection('users').deleteMany({ id: { $in: ids } });
  }
  await closeMongo(); await client.close();
}
