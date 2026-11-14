import 'dotenv/config';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoClient } from 'mongodb';

const primaryName = process.env.MONGODB_DB_NAME?.trim().toLowerCase();
const testName = 'zflix_vip_payment_test_20261114';
if (!process.env.MONGODB_URI?.trim() || primaryName === testName || !primaryName) throw new Error('A distinct primary and VIP test database are required');
process.env.MONGODB_DB_NAME = testName;
process.env.DATA_STORE = 'mongodb';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET ||= 'test-only-secret-with-at-least-thirty-two-characters';
const { default: app } = await import('../src/app.js');
const { closeMongo } = await import('../src/core/database/mongo.js');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const userId = 2147482501, adminId = 2147482502, modId = 2147482503;
const sessionIds = ['vip-payment-user', 'vip-payment-admin', 'vip-payment-mod'];
const auth = (id, sid) => `Bearer ${jwt.sign({ sid }, process.env.JWT_ACCESS_SECRET, { subject: String(id), algorithm: 'HS256' })}`;
const cleanFixture = async (db) => {
  await db.collection('notifications').deleteMany({ user_id: userId });
  await db.collection('user_subscriptions').deleteMany({ user_id: userId });
  await db.collection('transactions').deleteMany({ user_id: userId, payment_method: { $in: ['bank_transfer', 'manual_grant'] } });
  await db.collection('subscription_plans').deleteMany({ id: { $in: [9501, 9502] } });
  await db.collection('auth_sessions').deleteMany({ id: { $in: sessionIds } });
  await db.collection('users').deleteMany({ id: { $in: [userId, adminId, modId] } });
};
try {
  await client.connect();
  const db = client.db(testName);
  const existing = await db.collection('users').findOne({ id: userId });
  if (existing && existing.username !== 'vip_test_user') throw new Error('VIP test fixture IDs already used');
  if (existing) await cleanFixture(db);
  const expiry = new Date(Date.now() + 3_600_000);
  await db.collection('users').insertMany([
    { id: userId, role: 'user', username: 'vip_test_user' },
    { id: adminId, role: 'admin', username: 'vip_test_admin' },
    { id: modId, role: 'moderator', username: 'vip_test_mod' },
  ].map((row) => ({ _id: row.id, ...row, email: `${row.username}@example.invalid`, status: 'active', vip_expires_at: null })));
  await db.collection('auth_sessions').insertMany([userId, adminId, modId].map((id, index) => ({ _id: sessionIds[index], id: sessionIds[index],
    user_id: id, revoked_at: null, expires_at: expiry, absolute_expires_at: expiry })));
  await db.collection('subscription_plans').insertMany([
    { _id: 9501, id: 9501, name: 'VIP test tháng', duration_days: 30, price: 99000, discount_price: 69000, is_active: 1, display_order: 1 },
    { _id: 9502, id: 9502, name: 'VIP test năm', duration_days: 365, price: 990000, discount_price: 690000, is_active: 1, display_order: 2 },
  ]);
  const user = auth(userId, sessionIds[0]), admin = auth(adminId, sessionIds[1]), mod = auth(modId, sessionIds[2]);
  const api = (token) => request(app).post('/api/v1/vip/orders').set('Authorization', token).set('Origin', 'http://localhost:5173');
  const plans = await request(app).get('/api/v1/vip/plans').set('Authorization', user);
  assert.equal(plans.status, 200, JSON.stringify(plans.body));
  assert.equal(plans.body.plans.length, 2);
  const created = await api(user).send({ planId: 9501, amount: 1, status: 'PAID' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.order.id;
  assert.equal(created.body.order.amount, 69000);
  assert.equal(created.body.order.status, 'PENDING');
  const changedPlan = await request(app).put('/api/v1/admin/vip-payments/plans/9501').set('Authorization', admin)
    .send({ months: 1, price: 109000, discountPrice: 79000 });
  assert.equal(changedPlan.status, 200, JSON.stringify(changedPlan.body));
  assert.equal((await db.collection('transactions').findOne({ id })).final_amount, 69000);
  const otherHistory = await request(app).get('/api/v1/vip/orders').set('Authorization', mod);
  assert.equal(otherHistory.status, 200);
  assert.equal(otherHistory.body.orders.length, 0);
  assert.equal((await request(app).post(`/api/v1/admin/vip-payments/orders/${id}/review`).set('Authorization', user).send({ decision: 'approve' })).status, 403);
  assert.equal((await request(app).post(`/api/v1/vip/orders/${id}/submit`).set('Authorization', admin)).status, 409);
  const submitted = await request(app).post(`/api/v1/vip/orders/${id}/submit`).set('Authorization', user);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.equal((await db.collection('users').findOne({ id: userId })).vip_expires_at, null);
  assert.equal((await request(app).post(`/api/v1/vip/orders/${id}/submit`).set('Authorization', user)).status, 409);
  const concurrent = await Promise.all([mod, admin].map((token) => request(app)
    .post(`/api/v1/admin/vip-payments/orders/${id}/review`).set('Authorization', token).send({ decision: 'approve' })));
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409], JSON.stringify(concurrent.map((response) => response.body)));
  const firstExpiry = (await db.collection('users').findOne({ id: userId })).vip_expires_at;
  assert.ok(firstExpiry > new Date());
  assert.equal((await request(app).post(`/api/v1/admin/vip-payments/orders/${id}/review`).set('Authorization', admin).send({ decision: 'approve' })).status, 409);
  assert.equal((await db.collection('users').findOne({ id: userId })).vip_expires_at.getTime(), firstExpiry.getTime());
  assert.equal(await db.collection('user_subscriptions').countDocuments({ transaction_id: id }), 1);
  assert.equal(await db.collection('notifications').countDocuments({ user_id: userId, type: 'vip' }), 1);
  const second = await api(user).send({ planId: 9502 });
  assert.equal(second.status, 201, JSON.stringify(second.body));
  await request(app).post(`/api/v1/vip/orders/${second.body.order.id}/submit`).set('Authorization', user);
  const reject = await request(app).post(`/api/v1/admin/vip-payments/orders/${second.body.order.id}/review`).set('Authorization', admin)
    .send({ decision: 'reject', reason: 'Không tìm thấy khoản chuyển tương ứng' });
  assert.equal(reject.status, 200, JSON.stringify(reject.body));
  assert.equal((await db.collection('users').findOne({ id: userId })).vip_expires_at.getTime(), firstExpiry.getTime());
  assert.equal(await db.collection('notifications').countDocuments({ user_id: userId, type: 'vip' }), 2);
  assert.equal((await request(app).post(`/api/v1/admin/users/${userId}/vip`).set('Authorization', mod).send({ days: 30, reason: 'Thử nghiệm' })).status, 403);
  assert.equal((await request(app).post(`/api/v1/admin/users/${userId}/vip`).set('Authorization', admin).send({ days: 30 })).status, 400);
  const grant = await request(app).post(`/api/v1/admin/users/${userId}/vip`).set('Authorization', admin)
    .send({ days: 30, reason: 'Cấp VIP cho bài kiểm thử' });
  assert.equal(grant.status, 200, JSON.stringify(grant.body));
  const audit = await db.collection('transactions').findOne({ user_id: userId, payment_method: 'manual_grant' });
  assert.equal(audit.grant_reason, 'Cấp VIP cho bài kiểm thử');
  assert.equal(audit.reviewed_by, adminId);
  assert.equal(audit.final_amount, 0);
  console.log('VIP payment isolated flow passed: ownership, user cannot grant, approval once, rejection, manual grant policy');
} finally {
  await cleanFixture(client.db(testName));
  await closeMongo(); await client.close();
}
