import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { securityConfig } from '../src/config/security.config.js';
import { connectMongo, closeMongo, mongoCollection } from '../src/core/database/mongo.js';

const expected = 'community_test_schema_20261101';
if (process.env.DATA_STORE !== 'mongodb' || !process.env.COMMUNITY_TEST_MONGODB_URI) {
  throw new Error('Dedicated MongoDB test configuration required');
}
process.env.MONGODB_URI = process.env.COMMUNITY_TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = expected;
const db = await connectMongo();
if (db.databaseName !== expected) throw new Error(`Refusing test writes to ${db.databaseName}`);

const seed = randomInt(300000000, 700000000);
const adminId = seed, userId = seed + 1, postId = seed + 2;
const ids = [adminId, userId];
const expires = new Date(Date.now() + 3600000);
const app = createApp();
const auth = (id) => ({ Authorization: `Bearer ${jwt.sign({ sid: id }, securityConfig.jwtAccessSecret, { subject: String(id), expiresIn: '5m', algorithm: 'HS256' })}` });

try {
  await (await mongoCollection('users')).insertMany(ids.map((id) => ({
    _id: id, id, username: `role_${id}`, email: `role_${id}@example.test`,
    role: id === adminId ? 'admin' : 'user', status: 'active',
  })));
  await (await mongoCollection('auth_sessions')).insertMany(ids.map((id) => ({
    _id: id, id, user_id: id, refresh_token_hash: `role_${id}`,
    revoked_at: null, expires_at: expires, absolute_expires_at: expires,
  })));

  let response = await request(app).patch(`/api/v1/admin/users/${userId}`).set(auth(userId)).send({ role: 'moderator' });
  assert.equal(response.status, 403);
  response = await request(app).patch(`/api/v1/admin/users/${userId}`).set(auth(adminId)).send({ role: 'moderator' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.role, 'moderator');
  assert.equal((await (await mongoCollection('users')).findOne({ id: userId })).role, 'moderator');

  response = await request(app).get('/api/v1/admin/check').set(auth(userId));
  assert.equal(response.status, 200);
  response = await request(app).get('/api/v1/admin/users').set(auth(userId));
  assert.equal(response.status, 403);
  response = await request(app).patch(`/api/v1/admin/users/${adminId}`).set(auth(userId)).send({ role: 'user' });
  assert.equal(response.status, 403);
  response = await request(app).patch(`/api/v1/admin/users/${adminId}`).set(auth(adminId)).send({ role: 'moderator' });
  assert.equal(response.status, 400);

  const now = new Date();
  await (await mongoCollection('community_posts')).insertOne({
    _id: postId, id: postId, author_id: adminId, content_type: 'community_post',
    type: 'normal', category: 'discussion', title: 'Role smoke post',
    content: 'Content for the moderator role smoke test.', visibility: 'public',
    status: 'active', comment_count: 0, created_at: now, updated_at: now,
  });
  response = await request(app).delete(`/api/v1/community/posts/${postId}`).set(auth(userId));
  assert.equal(response.status, 204, JSON.stringify(response.body));
  assert.equal((await (await mongoCollection('community_posts')).findOne({ _id: postId })).status, 'deleted');

  response = await request(app).patch(`/api/v1/admin/users/${userId}`).set(auth(adminId)).send({ role: 'user' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.role, 'user');
  assert.equal((await (await mongoCollection('users')).findOne({ id: userId })).role, 'user');
  response = await request(app).get('/api/v1/admin/check').set(auth(userId));
  assert.equal(response.status, 403);
  console.log('admin role smoke passed: grant, MongoDB persistence, moderation, admin denial, revoke');
} finally {
  await (await mongoCollection('moderation_audit')).deleteMany({ actorId: userId, targetId: postId });
  await (await mongoCollection('community_posts')).deleteOne({ _id: postId });
  await (await mongoCollection('auth_sessions')).deleteMany({ user_id: { $in: ids } });
  await (await mongoCollection('users')).deleteMany({ id: { $in: ids } });
  await closeMongo();
}
