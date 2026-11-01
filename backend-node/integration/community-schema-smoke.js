import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import assert from 'node:assert/strict';
import { communitySchemas } from '../src/modules/community/community.schema.js';

const name = process.env.COMMUNITY_TEST_DB_NAME || '';
const uri = process.env.COMMUNITY_TEST_MONGODB_URI || '';
if (!uri.trim() || name !== 'community_test_schema_20261101' || !name.startsWith('community_test') || name === 'zflix' || name === process.env.MONGODB_DB_NAME) throw new Error('The dedicated community test database is required');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const ids = Array.from({ length: 5 }, () => new ObjectId());
try {
  await client.connect();
  const db = client.db(name);
  for (const [name, definition] of Object.entries(communitySchemas)) {
    const info = await db.listCollections({ name }).next();
    assert.ok(info?.options?.validator?.$jsonSchema, `${name}: validator missing`);
    const indexes = await db.collection(name).indexes();
    for (const expected of definition.indexes) assert.ok(indexes.some((actual) => JSON.stringify(actual.key) === JSON.stringify(expected.key) && Boolean(actual.unique) === Boolean(expected.unique)), `${name}: index missing`);
  }
  const posts = db.collection('community_posts');
  const votes = db.collection('community_post_votes');
  await assert.rejects(posts.insertOne({ _id: ids[0], author_id: 1 }), (error) => error.code === 121);
  const screenshot = { author_id: 1, type: 'screenshot', title: 'Moment', content: '', visibility: 'public', status: 'active', created_at: new Date(), updated_at: new Date(), production_id: 1, episode_id: 1, timestamp_seconds: 0, screenshot_key: 'community/posts/test.png', images: ['community/posts/test.png'] };
  const { timestamp_seconds: ignoredTimestamp, ...missingTimestamp } = screenshot;
  assert.equal(ignoredTimestamp, 0);
  await assert.rejects(posts.insertOne({ _id: ids[3], ...missingTimestamp }), (error) => error.code === 121);
  await posts.insertOne({ _id: ids[4], ...screenshot });
  await votes.insertOne({ _id: ids[1], post_id: 2147483000, user_id: 2147483000, value: 1 });
  await assert.rejects(votes.insertOne({ _id: ids[2], post_id: 2147483000, user_id: 2147483000, value: -1 }), (error) => error.code === 11000);
  console.log('Validators, indexes and duplicate vote rejection verified');
} finally {
  if (client.topology?.isConnected()) {
    const db = client.db(name);
    await db.collection('community_posts').deleteMany({ _id: { $in: [ids[0], ids[3], ids[4]] } });
    await db.collection('community_post_votes').deleteMany({ _id: { $in: ids.slice(1) } });
  }
  await client.close();
}
