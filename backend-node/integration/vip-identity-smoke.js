import 'dotenv/config';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoClient } from 'mongodb';

const databaseName = 'zflix_vip_payment_test_20261114';
if (!process.env.MONGODB_URI?.trim() || !process.env.MONGODB_DB_NAME?.trim()
  || process.env.MONGODB_DB_NAME.trim().toLowerCase() === databaseName) throw new Error('Dedicated VIP test database required');
process.env.MONGODB_DB_NAME = databaseName;
process.env.DATA_STORE = 'mongodb';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ||= 'test-only-secret-with-at-least-thirty-two-characters';
const { default: app } = await import('../src/app.js');
const { closeMongo } = await import('../src/core/database/mongo.js');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const ids = [2147482401, 2147482402, 2147482403];
const postIds = ids.map((id) => id + 10);
const commentIds = ids.map((id) => id + 20);
const postCommentIds = ids.map((id) => id + 30);
const clean = async (db) => {
  await db.collection('community_post_comments').deleteMany({ id: { $in: [...postCommentIds, postCommentIds[1] + 10] } });
  await db.collection('community_posts').deleteMany({ id: { $in: postIds } });
  await db.collection('comments').deleteMany({ id: { $in: [...commentIds, commentIds[1] + 10] } });
  await db.collection('ratings').deleteMany({ user_id: { $in: ids }, production_id: 2147482400 });
  await db.collection('users').deleteMany({ id: { $in: ids } });
};
try {
  await client.connect();
  const db = client.db(databaseName);
  const existing = await db.collection('users').findOne({ id: ids[0] });
  if (existing && existing.username !== 'vip_identity_regular') throw new Error('VIP identity fixture collision');
  if (existing) await clean(db);
  const now = new Date();
  const expiry = [null, new Date(now.getTime() + 86400000), new Date(now.getTime() - 86400000)];
  await db.collection('users').insertMany(ids.map((id, index) => ({ _id: id, id,
    username: ['vip_identity_regular', 'vip_identity_active', 'vip_identity_expired'][index],
    email: `vip-identity-${index}@example.invalid`, status: 'active', role: 'user', vip_expires_at: expiry[index] })));
  await db.collection('community_posts').insertMany(ids.map((id, index) => ({ _id: postIds[index], id: postIds[index],
    author_id: id, title: `VIP identity ${index}`, content: 'Test', content_type: 'community_post',
    visibility: 'public', status: 'active', type: 'normal', category: 'discussion', images: [], created_at: now })));
  await db.collection('community_post_comments').insertMany([...ids.map((id, index) => ({ _id: postCommentIds[index], id: postCommentIds[index],
    post_id: postIds[0], author_id: id, content: 'Test', status: 'active', created_at: now })),
  { _id: postCommentIds[1] + 10, id: postCommentIds[1] + 10, post_id: postIds[0], parent_id: postCommentIds[0],
    author_id: ids[1], content: 'VIP reply', status: 'active', created_at: now }]);
  await db.collection('comments').insertMany([...ids.map((id, index) => ({ _id: commentIds[index], id: commentIds[index],
    user_id: id, production_id: 2147482400, content: 'Test', status: 'active', parent_id: null, created_at: now })),
  { _id: commentIds[1] + 10, id: commentIds[1] + 10, user_id: ids[1], production_id: 2147482400,
    parent_id: commentIds[0], content: 'VIP reply', status: 'active', created_at: now }]);
  await db.collection('ratings').insertMany(ids.map((id, index) => ({ _id: `vip-rating-${id}`, user_id: id,
    production_id: 2147482400, rating: 5, review_content: 'Test', updated_at: now, created_at: now, index })));
  const movie = await request(app).get('/api/v1/productions/2147482400/comments?page=1&limit=20&parentId=root');
  assert.equal(movie.status, 200, JSON.stringify(movie.body));
  for (const [index, id] of ids.entries()) assert.equal(new Date(movie.body.items.find((item) => item.user_id === id).vip_expires_at || 0).getTime(), expiry[index]?.getTime() || 0);
  const movieReply = await request(app).get(`/api/v1/productions/2147482400/comments?page=1&limit=10&parentId=${commentIds[0]}`);
  assert.equal(movieReply.body.items[0].vip_expires_at, expiry[1].toISOString());
  const feed = await request(app).get('/api/v1/community/posts');
  assert.equal(feed.status, 200, JSON.stringify(feed.body));
  for (const [index, id] of ids.entries()) assert.equal(new Date(feed.body.items.find((post) => post.author_id === id).author.vip_expires_at || 0).getTime(), expiry[index]?.getTime() || 0);
  const postComments = await request(app).get(`/api/v1/community/posts/${postIds[0]}/comments`);
  assert.equal(postComments.status, 200, JSON.stringify(postComments.body));
  assert.equal(postComments.body.items.find((item) => item.author_id === ids[1]).author.vip_expires_at, expiry[1].toISOString());
  const postReply = await request(app).get(`/api/v1/community/posts/${postIds[0]}/comments?parentId=${postCommentIds[0]}`);
  assert.equal(postReply.body.items[0].author.vip_expires_at, expiry[1].toISOString());
  const profile = await request(app).get(`/api/v1/community/users/${ids[1]}`);
  assert.equal(profile.body.vip_expires_at, expiry[1].toISOString());
  const ratings = await request(app).get('/api/v1/productions/2147482400/ratings');
  assert.equal(ratings.body.items.find((item) => item.user_id === ids[1]).vip_expires_at, expiry[1].toISOString());
  console.log('VIP identity API smoke passed for regular, active and expired users across movie/community comments, replies, posts, ratings and profile');
} finally {
  await clean(client.db(databaseName));
  await closeMongo(); await client.close();
}
