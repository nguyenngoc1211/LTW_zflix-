import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { securityConfig } from '../src/config/security.config.js';
import { connectMongo, closeMongo, mongoCollection, withMongoTransaction } from '../src/core/database/mongo.js';
import { awardPoint } from '../src/modules/community/points.service.js';
import { claimQuest } from '../src/modules/community/quests.service.js';

const expected = 'community_test_schema_20261101';
if (process.env.DATA_STORE !== 'mongodb' || !process.env.COMMUNITY_TEST_MONGODB_URI) throw new Error('Dedicated test MongoDB required');
process.env.MONGODB_URI = process.env.COMMUNITY_TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = expected;
const db = await connectMongo();
if (db.databaseName !== expected) throw new Error(`Refusing writes to ${db.databaseName}`);

const seed = randomInt(300000000, 700000000);
const [adminId, modId, authorId, reporterId, privatePostId, reportPostId, commentId, productionId, movieCommentId] = Array.from({ length: 9 }, (_, index) => seed + index);
const userIds = [adminId, modId, authorId, reporterId];
const postIds = [privatePostId, reportPostId];
const reportIds = [];
const now = new Date(), expires = new Date(now.getTime() + 3600000);
const app = createApp();
const auth = (id) => ({ Authorization: `Bearer ${jwt.sign({ sid: id }, securityConfig.jwtAccessSecret, { subject: String(id), expiresIn: '5m', algorithm: 'HS256' })}` });
const api = (method, url, id) => request(app)[method](url).set(auth(id));

try {
  await (await mongoCollection('users')).insertMany(userIds.map((id) => ({ _id: id, id, username: `usecase_${id}`, email: `usecase_${id}@example.test`, role: id === adminId ? 'admin' : id === modId ? 'moderator' : 'user', status: 'active' })));
  await (await mongoCollection('auth_sessions')).insertMany(userIds.map((id) => ({ _id: id, id, user_id: id, refresh_token_hash: `usecase_${id}`, revoked_at: null, expires_at: expires, absolute_expires_at: expires })));
  await (await mongoCollection('community_posts')).insertMany(postIds.map((id) => ({ _id: id, id, author_id: authorId, type: 'normal', content_type: 'community_post', category: 'discussion', title: `Moderation ${id}`, content: 'Nội dung bài viết đủ dài cho kiểm tra quyền kiểm duyệt.', visibility: id === privatePostId ? 'members' : 'public', ...(id === privatePostId && { community_id: seed }), status: 'active', comment_count: id === privatePostId ? 1 : 0, created_at: now, updated_at: now })));
  await (await mongoCollection('community_post_comments')).insertOne({ _id: commentId, id: commentId, post_id: privatePostId, author_id: authorId, content: 'Bình luận cần xử lý trong bài riêng tư.', status: 'active', created_at: now, updated_at: now });
  await withMongoTransaction((session) => awardPoint({ userId: authorId, type: 'post', sourceType: 'post', sourceId: reportPostId, content: `Moderation ${reportPostId} Nội dung bài viết đủ dài cho kiểm tra quyền kiểm duyệt.`, session }));
  await claimQuest(authorId, 'daily_post');

  let response = await api('get', '/api/v1/admin/quests/community-posts', modId);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body.items.some((item) => item.id === privatePostId));
  response = await api('get', `/api/v1/community/posts/${privatePostId}`, modId);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  response = await api('get', `/api/v1/community/posts/${privatePostId}/comments`, modId);
  assert.equal(response.status, 200);
  response = await api('get', `/api/v1/admin/content/comments?source=post&sourceId=${privatePostId}&search=x%E1%BB%AD%20l%C3%BD&page=1`, modId);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.items[0].id, commentId);
  response = await api('delete', `/api/v1/community/posts/${privatePostId}/comments/${commentId}`, modId);
  assert.equal(response.status, 204, JSON.stringify(response.body));

  response = await api('post', '/api/v1/moderation/reports', reporterId).send({ targetType: 'post', targetId: reportPostId, reason: 'spam' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  reportIds.push(response.body.id);
  response = await api('get', '/api/v1/admin/moderation/reports?status=open', modId);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(response.body.items.some((item) => item._id === reportIds[0]));
  response = await api('post', `/api/v1/admin/moderation/reports/${encodeURIComponent(reportIds[0])}/resolve`, modId).send({ action: 'hide', reason: 'Bài viết vi phạm đã được xác minh' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal((await (await mongoCollection('community_posts')).findOne({ _id: reportPostId })).status, 'hidden');
  assert.ok(await (await mongoCollection('point_transactions')).countDocuments({ userId: authorId, type: 'reversal' }) > 0);
  assert.equal((await (await mongoCollection('quest_claims')).findOne({ userId: authorId, questId: 'daily_post' })).status, 'revoked');
  assert.equal(await (await mongoCollection('moderation_audit')).countDocuments({ reportId: reportIds[0], actorId: modId }), 1);
  response = await api('post', `/api/v1/admin/moderation/reports/${encodeURIComponent(reportIds[0])}/resolve`, adminId).send({ action: 'hide', reason: 'Không được xử lý báo cáo hai lần' });
  assert.equal(response.status, 409);

  response = await api('post', '/api/v1/moderation/reports', reporterId).send({ targetType: 'user', targetId: adminId, reason: 'other' });
  assert.equal(response.status, 201);
  reportIds.push(response.body.id);
  response = await api('post', `/api/v1/admin/moderation/reports/${encodeURIComponent(reportIds[1])}/resolve`, modId).send({ action: 'warn', reason: 'Không được xử lý tài khoản nhân sự' });
  assert.equal(response.status, 403);
  response = await api('post', `/api/v1/admin/moderation/reports/${encodeURIComponent(reportIds[1])}/resolve`, adminId).send({ action: 'dismiss', reason: 'Không tìm thấy vi phạm trong báo cáo' });
  assert.equal(response.status, 200);

  await (await mongoCollection('productions')).insertOne({ _id: productionId, id: productionId, title: 'Moderation movie', status: 'ongoing', rating_count: 1, rating_avg: 4 });
  await (await mongoCollection('comments')).insertOne({ _id: movieCommentId, id: movieCommentId, user_id: authorId, production_id: productionId, content: 'Bình luận phim vi phạm.', status: 'active', created_at: now, updated_at: now });
  await (await mongoCollection('ratings')).insertOne({ _id: { user_id: authorId, production_id: productionId }, user_id: authorId, production_id: productionId, rating: 4, review_content: 'Review cần xử lý.', created_at: now, updated_at: now });
  response = await api('get', `/api/v1/admin/ratings?productionId=${productionId}`, modId);
  assert.equal(response.status, 200);
  response = await api('post', '/api/v1/moderation/reports', reporterId).send({ targetType: 'comment', targetId: movieCommentId, commentSource: 'movie', reason: 'spam' });
  assert.equal(response.status, 201);
  reportIds.push(response.body.id);
  response = await api('post', `/api/v1/admin/moderation/reports/${encodeURIComponent(response.body.id)}/resolve`, modId).send({ action: 'dismiss', reason: 'Bình luận không có dấu hiệu vi phạm' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  response = await api('post', '/api/v1/moderation/reports', reporterId).send({ targetType: 'rating', targetId: productionId, productionId, authorId, reason: 'spam' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  reportIds.push(response.body.id);
  response = await api('post', `/api/v1/admin/moderation/reports/${encodeURIComponent(response.body.id)}/resolve`, modId).send({ action: 'hide', reason: 'Review phim vi phạm đã xác minh' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal((await (await mongoCollection('ratings')).findOne({ user_id: authorId, production_id: productionId })).moderation_hidden, true);
  response = await api('delete', `/api/v1/admin/comments/${movieCommentId}`, modId);
  assert.equal(response.status, 204, JSON.stringify(response.body));
  response = await api('delete', `/api/v1/admin/ratings/${authorId}/${productionId}`, modId);
  assert.equal(response.status, 204, JSON.stringify(response.body));
  response = await api('delete', `/api/v1/community/posts/${privatePostId}`, modId);
  assert.equal(response.status, 204, JSON.stringify(response.body));

  for (const [method, url, body] of [
    ['get', '/api/v1/admin/users'], ['patch', `/api/v1/admin/users/${authorId}`, { role: 'admin' }],
    ['get', '/api/v1/admin/points/config'], ['get', '/api/v1/admin/quests/definitions'],
    ['get', '/api/v1/admin/moderation/flags'], ['post', '/api/v1/admin/notifications/broadcast', { title: 'x', message: 'x' }],
    ['post', '/api/v1/admin/search/reindex'], ['put', '/api/v1/admin/vip-payments/plans/1', { months: 1, price: 1, discountPrice: 0 }],
  ]) {
    response = body ? await api(method, url, modId).send(body) : await api(method, url, modId);
    assert.equal(response.status, 403, `${method} ${url}: ${response.status} ${JSON.stringify(response.body)}`);
  }
  response = await api('get', '/api/v1/admin/stats', modId);
  assert.equal(response.status, 200);
  assert.equal('totalRevenue' in response.body, false);
  assert.equal('recentUsers' in response.body, false);
  response = await api('get', '/api/v1/admin/stats', adminId);
  assert.equal(response.status, 200);
  assert.equal('totalRevenue' in response.body, true);
  response = await api('get', '/api/v1/admin/views', modId);
  assert.equal(response.status, 200);
  assert.equal(response.body.daily.some((day) => 'total_revenue' in day), false);
  response = await api('get', '/api/v1/admin/moderation/reports?status=all', adminId);
  assert.equal(response.status, 200);
  console.log('moderator use case smoke passed: community, reports, movie moderation, admin boundaries, audit and reversal');
} finally {
  await (await mongoCollection('moderation_audit')).deleteMany({ $or: [{ reportId: { $in: reportIds } }, { actorId: modId, targetId: { $in: [...postIds, commentId, movieCommentId, productionId] } }] });
  await (await mongoCollection('notifications')).deleteMany({ user_id: { $in: userIds } });
  await (await mongoCollection('community_reports')).deleteMany({ _id: { $in: reportIds } });
  await (await mongoCollection('point_transactions')).deleteMany({ userId: { $in: userIds } });
  await (await mongoCollection('quest_claims')).deleteMany({ userId: authorId });
  await (await mongoCollection('point_daily_quotas')).deleteMany({ userId: { $in: userIds } });
  await (await mongoCollection('point_content_fingerprints')).deleteMany({ userId: { $in: userIds } });
  await (await mongoCollection('community_post_comments')).deleteOne({ _id: commentId });
  await (await mongoCollection('community_posts')).deleteMany({ _id: { $in: postIds } });
  await (await mongoCollection('comments')).deleteOne({ _id: movieCommentId });
  await (await mongoCollection('ratings')).deleteOne({ user_id: authorId, production_id: productionId });
  await (await mongoCollection('productions')).deleteOne({ _id: productionId });
  await (await mongoCollection('auth_sessions')).deleteMany({ user_id: { $in: userIds } });
  await (await mongoCollection('users')).deleteMany({ id: { $in: userIds } });
  await closeMongo();
}
