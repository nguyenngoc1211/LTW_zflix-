import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import sharp from 'sharp';

const name = process.env.COMMUNITY_TEST_DB_NAME || '';
if (!process.env.COMMUNITY_TEST_MONGODB_URI?.trim() || name !== 'community_test_schema_20261101' || !name.startsWith('community_test') || name === 'zflix' || name === process.env.MONGODB_DB_NAME) throw new Error('The dedicated community test database is required');
process.env.MONGODB_URI = process.env.COMMUNITY_TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = name;
process.env.DATA_STORE = 'mongodb';
process.env.JWT_ACCESS_SECRET ||= 'test-only-secret-with-at-least-thirty-two-characters';
const { default: app } = await import('../src/app.js');
const { closeMongo } = await import('../src/core/database/mongo.js');
const { default: s3 } = await import('../src/core/storage/r2.js');
const originalSend = s3.send;
const client = new MongoClient(process.env.MONGODB_URI);
const userId = 2147482991, otherId = 2147482992;
const sessionIds = ['community-post-test-a', 'community-post-test-b'];
let postId;
let usersInserted = false;
let sessionsInserted = false;
let groupInserted = false;
let memberInserted = false;
let mediaInserted = false;
let screenshotId;
let movieCommentsInserted = false;
try {
  await client.connect();
  const db = client.db(name);
  for (const [collection, id] of [['users', userId], ['users', otherId], ['auth_sessions', sessionIds[0]], ['auth_sessions', sessionIds[1]], ['productions', 2147482987], ['episodes', 2147482988], ['community_groups', 2147482989]]) {
    if (await db.collection(collection).findOne({ _id: id })) throw new Error(`Test fixture already exists in ${collection}`);
  }
  if (await db.collection('ratings').findOne({ user_id: userId, production_id: 2147482987 })) throw new Error('Test rating fixture already exists');
  for (const id of [2147482961, 2147482962, 2147482963]) if (await db.collection('comments').findOne({ _id: id })) throw new Error('Test movie comment fixture already exists');
  const until = new Date(Date.now() + 3600000);
  await db.collection('users').insertMany([{ _id: userId, id: userId, username: 'community_test_owner', email: 'fixture@example.invalid', password: 'fixture-secret', avatar_url: '/fixture.png', status: 'active', role: 'user' }, { _id: otherId, id: otherId, username: 'community_test_other', status: 'active', role: 'user' }]);
  usersInserted = true;
  await db.collection('auth_sessions').insertMany(sessionIds.map((id, index) => ({ _id: id, id, user_id: index ? otherId : userId, revoked_at: null, expires_at: until, absolute_expires_at: until })));
  sessionsInserted = true;
  const token = (id, sid) => jwt.sign({ sid }, process.env.JWT_ACCESS_SECRET, { subject: String(id), algorithm: 'HS256' });
  const owner = `Bearer ${token(userId, sessionIds[0])}`;
  const other = `Bearer ${token(otherId, sessionIds[1])}`;
  await db.collection('productions').insertOne({ _id: 2147482987, id: 2147482987 });
  await db.collection('episodes').insertOne({ _id: 2147482988, id: 2147482988, production_id: 2147482987, duration: 120 });
  mediaInserted = true;
  await db.collection('comments').insertMany([2147482961, 2147482962, 2147482963].map((id) => ({ _id: id, id, user_id: userId, production_id: 2147482987, status: 'active', content: `Test ${id}`, created_at: new Date('2026-01-01T00:00:00Z') })));
  movieCommentsInserted = true;
  const firstComments = await request(app).get('/api/v1/productions/2147482987/comments?page=1&limit=2');
  assert.deepEqual(firstComments.body.items.map((item) => item.id), [2147482963, 2147482962]);
  assert.equal(firstComments.body.hasMore, true);
  const secondComments = await request(app).get('/api/v1/productions/2147482987/comments?page=2&limit=2');
  assert.deepEqual(secondComments.body.items.map((item) => item.id), [2147482961]);
  assert.equal(secondComments.body.hasMore, false);
  assert.equal((await request(app).get('/api/v1/productions/2147482987/comments?limit=51')).status, 400);
  assert.equal((await request(app).get('/api/v1/productions/2147482987/comments')).body.items.length, 3);
  const ratingUrl = '/api/v1/productions/2147482987/rating';
  assert.equal((await request(app).put(ratingUrl).send({ rating: 4 })).status, 401);
  assert.equal((await request(app).put(ratingUrl).set('Authorization', owner).send({ rating: 6 })).status, 400);
  assert.equal((await request(app).put(ratingUrl).set('Authorization', owner).send({ rating: 4, review: 'Community test review' })).status, 200);
  assert.equal((await request(app).put(ratingUrl).set('Authorization', owner).send({ rating: 5, review: 'Updated review' })).status, 200);
  const reviews = await request(app).get('/api/v1/productions/2147482987/ratings');
  assert.equal(reviews.status, 200);
  assert.equal(reviews.body.items.filter((item) => item.user_id === userId).length, 1);
  assert.equal(reviews.body.items.find((item) => item.user_id === userId).rating, 5);
  assert.equal((await request(app).delete(ratingUrl).set('Authorization', owner)).status, 204);
  for (const key of ['R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) process.env[key] = 'community-test-only';
  s3.send = async () => ({});
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  const screenshot = await request(app).post('/api/v1/community/posts/with-images').set('Authorization', owner).field('post', JSON.stringify({ type: 'screenshot', title: 'Moment', content: '', isSpoiler: true, productionId: 2147482987, episodeId: 2147482988, timestampSeconds: 15 })).attach('images', image, { filename: 'moment.png', contentType: 'image/png' });
  assert.equal(screenshot.status, 201, JSON.stringify(screenshot.body));
  screenshotId = screenshot.body.id;
  assert.equal((await request(app).patch(`/api/v1/community/posts/${screenshotId}`).set('Authorization', owner).send({ episodeId: null })).status, 400);
  const moments = await request(app).get('/api/v1/community/posts?type=screenshot&onMoviePage=true&movieId=2147482987&episodeId=2147482988');
  assert.ok(moments.body.items.some((item) => item.id === screenshotId));
  const forum = await request(app).get('/api/v1/community/posts?type=screenshot');
  assert.equal(forum.body.items.find((item) => item.id === screenshotId)?.is_spoiler, true);
  assert.equal((await request(app).put(`/api/v1/community/posts/${screenshotId}/vote`).set('Authorization', owner).send({ value: 1 })).body.score, 1);
  assert.equal((await request(app).post(`/api/v1/community/posts/${screenshotId}/comments`).set('Authorization', other).send({ content: 'A shared comment' })).status, 201);
  assert.equal((await request(app).patch(`/api/v1/community/posts/${screenshotId}`).set('Authorization', owner).send({ title: 'Updated moment' })).status, 200);
  for (const url of ['/api/v1/community/posts?type=screenshot', '/api/v1/community/posts?type=screenshot&onMoviePage=true&movieId=2147482987&episodeId=2147482988']) {
    const response = await request(app).get(url);
    const post = response.body.items.find((item) => item.id === screenshotId);
    assert.equal(post.title, 'Updated moment');
    assert.equal(post.score, 1);
    assert.equal(post.comment_count, 1);
    assert.equal(post.is_spoiler, true);
  }
  assert.equal((await request(app).get(`/api/v1/community/posts/${screenshotId}/comments`)).body.items[0].content, 'A shared comment');
  assert.equal((await request(app).get(`/api/v1/community/posts/${screenshotId}`)).body.timestamp_seconds, 15);
  assert.equal((await request(app).get('/api/v1/community/posts?type=screenshot&movieId=2147482987&episodeId=2147482989')).body.items.some((item) => item.id === screenshotId), false);
  assert.equal((await request(app).delete(`/api/v1/community/posts/${screenshotId}`).set('Authorization', owner)).status, 204);
  for (const url of ['/api/v1/community/posts?type=screenshot', '/api/v1/community/posts?type=screenshot&onMoviePage=true&movieId=2147482987&episodeId=2147482988']) {
    assert.equal((await request(app).get(url)).body.items.some((item) => item.id === screenshotId), false);
  }
  assert.equal((await request(app).post('/api/v1/community/posts').send({ title: 'x', content: 'y' })).status, 401);
  assert.equal((await request(app).post('/api/v1/community/posts').set('Authorization', owner).send({ title: 'x', content: 'y', status: 'hidden' })).status, 400);
  const created = await request(app).post('/api/v1/community/posts').set('Authorization', owner).send({ title: 'Test post', content: 'content', tags: ['film'], isSpoiler: true });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  postId = created.body.id;
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`)).status, 200);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/vote`).set('Authorization', owner).send({ value: 1 })).body.score, 1);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/vote`).set('Authorization', owner).send({ value: -1 })).body.score, -1);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/vote`).set('Authorization', owner).send({ value: 0 })).body.score, 0);
  const comment = await request(app).post(`/api/v1/community/posts/${postId}/comments`).set('Authorization', owner).send({ content: 'Bình luận', isSpoiler: true });
  assert.equal(comment.status, 201, JSON.stringify(comment.body));
  const commentId = comment.body.id;
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).send({ value: 1 })).status, 401);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', owner).send({ value: 1 })).body.score, 1);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', owner).send({ value: 1 })).body.score, 1);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', owner).send({ value: -1 })).body.score, -1);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', owner).send({ value: 0 })).body.score, 0);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', owner).send({ value: 2 })).status, 400);
  const concurrentVotes = await Promise.all([
    request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', owner).send({ value: 1 }),
    request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', other).send({ value: -1 }),
  ]);
  assert.ok(concurrentVotes.every((response) => response.status === 200));
  const votedComments = await request(app).get(`/api/v1/community/posts/${postId}/comments`);
  assert.equal(votedComments.body.items.find((item) => item.id === commentId).score, 0);
  await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', owner).send({ value: 0 });
  await request(app).put(`/api/v1/community/posts/${postId}/comments/${commentId}/vote`).set('Authorization', other).send({ value: 0 });
  assert.equal((await request(app).post(`/api/v1/community/posts/${postId}/comments`).set('Authorization', other).send({ content: 'Trả lời', parentId: commentId })).status, 201);
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}/comments?parentId=${commentId}`)).body.items.length, 1);
  assert.equal((await request(app).patch(`/api/v1/community/posts/${postId}/comments/${commentId}`).set('Authorization', other).send({ content: 'Không hợp lệ' })).status, 404);
  assert.equal((await request(app).patch(`/api/v1/community/posts/${postId}/comments/${commentId}`).set('Authorization', owner).send({ content: 'Đã sửa' })).status, 200);
  assert.equal((await request(app).delete(`/api/v1/community/posts/${postId}/comments/${commentId}`).set('Authorization', owner)).status, 204);
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`)).body.comment_count, 1);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/save`).set('Authorization', owner)).status, 204);
  const savedList = await request(app).get('/api/v1/community/posts/saved').set('Authorization', owner);
  const savedPost = savedList.body.items.find((item) => item.id === postId);
  assert.equal(savedPost.is_saved, true);
  assert.equal(savedPost.author.username, 'community_test_owner');
  assert.equal(savedPost.author.avatar_url, '/fixture.png');
  assert.equal(savedPost.author.email, undefined);
  assert.equal(savedPost.author.password, undefined);
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`).set('Authorization', other)).body.is_saved, false);
  assert.equal((await request(app).delete(`/api/v1/community/posts/${postId}/save`).set('Authorization', owner)).status, 204);
  assert.equal((await request(app).get('/api/v1/community/posts/saved').set('Authorization', owner)).body.items.some((item) => item.id === postId), false);
  assert.equal((await request(app).patch(`/api/v1/community/posts/${postId}`).set('Authorization', other).send({ title: 'stolen' })).status, 404);
  assert.equal((await request(app).patch(`/api/v1/community/posts/${postId}`).set('Authorization', owner).send({ title: 'Updated' })).status, 200);
  const listing = await request(app).get('/api/v1/community/posts?type=normal&limit=1');
  assert.equal(listing.status, 200);
  assert.equal((await request(app).delete(`/api/v1/community/posts/${postId}`).set('Authorization', other)).status, 404);
  const groupId = 2147482989;
  await db.collection('community_groups').insertOne({ _id: groupId, owner_id: userId, slug: 'community-post-smoke-group', name: 'Test', status: 'active', created_at: new Date() });
  groupInserted = true;
  assert.equal((await request(app).patch(`/api/v1/community/posts/${postId}`).set('Authorization', owner).send({ communityId: groupId })).status, 403);
  await db.collection('community_members').insertOne({ community_id: groupId, user_id: userId, role: 'owner', status: 'active', created_at: new Date() });
  memberInserted = true;
  assert.equal((await request(app).patch(`/api/v1/community/posts/${postId}`).set('Authorization', owner).send({ communityId: groupId })).status, 200);
  assert.equal((await request(app).patch(`/api/v1/community/posts/${postId}`).set('Authorization', owner).send({ visibility: 'members' })).status, 200);
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`)).status, 404);
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`).set('Authorization', other)).status, 404);
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`).set('Authorization', owner)).status, 200);
  assert.equal((await request(app).put(`/api/v1/community/posts/${postId}/save`).set('Authorization', other)).status, 404);
  assert.equal((await request(app).get('/api/v1/community/posts').set('Authorization', owner)).body.items.some((item) => item.id === postId), true);
  assert.equal((await request(app).get('/api/v1/community/posts')).body.items.some((item) => item.id === postId), false);
  await db.collection('community_members').insertOne({ community_id: groupId, user_id: otherId, role: 'moderator', status: 'active', created_at: new Date() });
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`).set('Authorization', other)).status, 200);
  await db.collection('community_members').updateOne({ community_id: groupId, user_id: otherId }, { $set: { status: 'banned' } });
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`).set('Authorization', other)).status, 404);
  await db.collection('community_members').updateOne({ community_id: groupId, user_id: otherId }, { $set: { status: 'active' } });
  assert.equal((await request(app).delete(`/api/v1/community/posts/${postId}`).set('Authorization', other)).status, 204);
  assert.equal((await request(app).get(`/api/v1/community/posts/${postId}`)).status, 404);
  console.log('Post authentication, ownership, validation, listing and soft delete verified');
} finally {
  if (client.topology?.isConnected()) {
    const db = client.db(name);
    if (postId) await db.collection('community_posts').deleteOne({ _id: postId, author_id: userId });
    if (postId) await db.collection('community_saved_posts').deleteMany({ post_id: postId, user_id: userId });
    if (postId) await db.collection('community_post_votes').deleteMany({ post_id: postId, user_id: userId });
    if (postId) {
      const comments = await db.collection('community_post_comments').find({ post_id: postId }, { projection: { _id: 1 } }).toArray();
      await db.collection('community_comment_votes').deleteMany({ comment_id: { $in: comments.map((comment) => comment._id) }, user_id: { $in: [userId, otherId] } });
      await db.collection('community_post_comments').deleteMany({ post_id: postId });
    }
    if (screenshotId) {
      await db.collection('community_post_votes').deleteMany({ post_id: screenshotId, user_id: userId });
      await db.collection('community_post_comments').deleteMany({ post_id: screenshotId, author_id: otherId });
      await db.collection('community_posts').deleteOne({ _id: screenshotId, author_id: userId });
    }
    if (mediaInserted) {
      await db.collection('ratings').deleteOne({ user_id: userId, production_id: 2147482987 });
      await db.collection('productions').deleteOne({ _id: 2147482987 });
      await db.collection('episodes').deleteOne({ _id: 2147482988 });
    }
    if (movieCommentsInserted) await db.collection('comments').deleteMany({ _id: { $in: [2147482961, 2147482962, 2147482963] }, production_id: 2147482987, user_id: userId });
    if (memberInserted) await db.collection('community_members').deleteMany({ community_id: 2147482989, user_id: { $in: [userId, otherId] } });
    if (groupInserted) await db.collection('community_groups').deleteOne({ _id: 2147482989 });
    if (sessionsInserted) await db.collection('auth_sessions').deleteMany({ _id: { $in: sessionIds } });
    if (usersInserted) await db.collection('users').deleteMany({ _id: { $in: [userId, otherId] } });
  }
  await closeMongo();
  s3.send = originalSend;
  await client.close();
}
