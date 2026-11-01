import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import assert from 'node:assert/strict';
import { communitySchemas } from '../src/modules/community/community.schema.js';

const name = process.env.COMMUNITY_TEST_DB_NAME || '';
const uri = process.env.COMMUNITY_TEST_MONGODB_URI || '';
if (!uri || !/^community_test_[a-z0-9_]+$/i.test(name) || name === process.env.MONGODB_DB_NAME) throw new Error('A separate community test database is required');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const ids = [new ObjectId(), new ObjectId(), new ObjectId()];
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
  await votes.insertOne({ _id: ids[1], post_id: 2147483000, user_id: 2147483000, value: 1 });
  await assert.rejects(votes.insertOne({ _id: ids[2], post_id: 2147483000, user_id: 2147483000, value: -1 }), (error) => error.code === 11000);
  console.log('Validators, indexes and duplicate vote rejection verified');
} finally {
  if (client.topology?.isConnected()) {
    const db = client.db(name);
    await db.collection('community_posts').deleteOne({ _id: ids[0] });
    await db.collection('community_post_votes').deleteMany({ _id: { $in: ids.slice(1) } });
  }
  await client.close();
}
