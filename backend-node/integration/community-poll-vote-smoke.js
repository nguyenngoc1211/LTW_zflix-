import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoClient } from 'mongodb';

const name = process.env.COMMUNITY_TEST_DB_NAME?.trim();
const uri = process.env.COMMUNITY_TEST_MONGODB_URI?.trim();
if (!uri || name !== 'community_test_schema_20261101' || name.toLowerCase() === process.env.MONGODB_DB_NAME?.trim().toLowerCase()) throw new Error('Dedicated Community test database required');
process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = name;
process.env.DATA_STORE = 'mongodb';
process.env.JWT_ACCESS_SECRET ||= 'test-only-secret-with-at-least-thirty-two-characters';

const { default: app } = await import('../src/app.js');
const { closeMongo } = await import('../src/core/database/mongo.js');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const userId = 2147482681;
const postId = 2147482682;
const sessionId = 'community-poll-vote-smoke';
try {
  await client.connect();
  const db = client.db(name);
  for (const [collection, id] of [['users', userId], ['auth_sessions', sessionId], ['community_posts', postId]]) {
    if (await db.collection(collection).findOne({ _id: id })) throw new Error(`Fixture ID occupied in ${collection}`);
  }
  await db.collection('users').insertOne({ _id: userId, id: userId, username: 'poll_vote_smoke', status: 'active', role: 'user' });
  await db.collection('auth_sessions').insertOne({ _id: sessionId, id: sessionId, user_id: userId, refresh_token_hash: 'poll-vote-smoke', revoked_at: null, expires_at: new Date(Date.now() + 3600000), absolute_expires_at: new Date(Date.now() + 3600000) });
  await db.collection('community_posts').insertOne({ _id: postId, id: postId, author_id: userId, type: 'normal', content_type: 'community_post', title: 'Poll vote smoke', content: '', category: 'poll', poll_options: ['A', 'B'], visibility: 'public', status: 'active', created_at: new Date(), updated_at: new Date() });
  const token = jwt.sign({ sid: sessionId }, process.env.JWT_ACCESS_SECRET, { subject: String(userId), algorithm: 'HS256' });
  const vote = (option) => request(app).put(`/api/v1/community/posts/${postId}/poll-vote`).set('Authorization', `Bearer ${token}`).send({ option });
  const first = await vote(0);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body.poll_counts, [1, 0]);
  const changed = await vote(1);
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.deepEqual(changed.body.poll_counts, [0, 1]);
  const repeated = await vote(1);
  assert.equal(repeated.status, 200, JSON.stringify(repeated.body));
  assert.deepEqual(repeated.body.poll_counts, [0, 1]);
  assert.equal(await db.collection('community_poll_votes').countDocuments({ post_id: postId, user_id: userId }), 1);
  const feed = await request(app).get(`/api/v1/community/posts/${postId}`).set('Authorization', `Bearer ${token}`);
  assert.equal(feed.status, 200);
  assert.equal(feed.body.viewer_poll_option, 1);
  console.log('Poll vote can change choices; one vote per user retained');
} finally {
  await client.db(name).collection('community_poll_votes').deleteMany({ post_id: postId, user_id: userId }).catch(() => {});
  await client.db(name).collection('community_posts').deleteOne({ _id: postId }).catch(() => {});
  await client.db(name).collection('auth_sessions').deleteOne({ _id: sessionId }).catch(() => {});
  await client.db(name).collection('users').deleteOne({ _id: userId }).catch(() => {});
  await client.close();
  await closeMongo();
}
