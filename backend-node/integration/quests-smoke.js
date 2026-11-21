import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { connectMongo, closeMongo, mongoCollection, withMongoTransaction } from '../src/core/database/mongo.js';
import { awardPoint, reversePoints } from '../src/modules/community/points.service.js';
import { achievementStatus, claimQuest, questStatus } from '../src/modules/community/quests.service.js';

const expected = 'community_test_schema_20261101';
if (process.env.MONGODB_DB_NAME !== expected) throw new Error(`Refusing writes outside ${expected}`);
const db = await connectMongo();
if (db.databaseName !== expected) throw new Error(`Connected to unexpected database ${db.databaseName}`);
const userId = randomInt(200000000, 900000000), sourceId = userId;
const now = new Date();
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
let created = false;
try {
  await (await mongoCollection('users')).insertOne({ _id: userId, id: userId, username: `quest_test_${userId}`, status: 'active', role: 'user', created_at: now });
  created = true;
  await withMongoTransaction((session) => awardPoint({ userId, type: 'post', sourceType: 'post', sourceId, content: 'Một bài viết hợp lệ có đủ nội dung khác nhau về bộ phim yêu thích', session }));
  const before = await questStatus(userId);
  assert.equal(before.quests.find((item) => item.id === 'daily_post').completed, true);
  assert.equal((await achievementStatus(userId)).find((item) => item.id === 'first_post').earned, true);
  const attempts = await Promise.allSettled([claimQuest(userId, 'daily_post'), claimQuest(userId, 'daily_post')]);
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(await (await mongoCollection('point_transactions')).countDocuments({ userId, type: 'quest' }), 1);
  await withMongoTransaction((session) => reversePoints({ sourceType: 'post', sourceId, session }));
  const claim = await (await mongoCollection('quest_claims')).findOne({ userId, questId: 'daily_post', period: day });
  assert.equal(claim.status, 'revoked');
  assert.equal(await (await mongoCollection('point_transactions')).countDocuments({ userId, reverses: `quest:daily_post:${day}:${userId}` }), 1);
  assert.equal((await achievementStatus(userId)).find((item) => item.id === 'first_post').earned, false);
  await assert.rejects(() => claimQuest(userId, 'daily_post'), { status: 409 });
  console.log('quests smoke passed: progress, concurrent claim, duplicate guard, reversal, achievement');
} finally {
  if (created) {
    await (await mongoCollection('notifications')).deleteMany({ user_id: userId });
    await (await mongoCollection('quest_claims')).deleteMany({ userId });
    await (await mongoCollection('point_transactions')).deleteMany({ userId });
    await (await mongoCollection('point_daily_quotas')).deleteMany({ userId });
    await (await mongoCollection('point_content_fingerprints')).deleteMany({ userId });
    await (await mongoCollection('point_review_flags')).deleteMany({ userId });
    await (await mongoCollection('users')).deleteOne({ _id: userId });
  }
  await closeMongo();
}
