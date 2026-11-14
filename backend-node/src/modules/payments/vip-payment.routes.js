import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { mongoCollection, nextNumericId, withMongoTransaction } from '../../core/database/mongo.js';
import { requireAuth } from '../../core/middleware/auth.middleware.js';
import { asyncHandler } from '../../core/utils/http.js';
import { createNotification, emitStoredNotification, ensureNotificationIndexes } from '../community/notification.service.js';
import { addCalendarMonths, bankSettings, billingMonths, newOrderCode, transferPayload } from './vip-payment.service.js';

export const vipPaymentRouter = Router();
export const vipPaymentAdminRouter = Router();
const mongoOnly = (req, res, next) => process.env.DATA_STORE === 'mongodb' ? next() : res.status(501).json({ message: 'Thanh toán VIP cần MongoDB' });
const staff = (req, res, next) => ['admin', 'moderator'].includes(req.user?.role) ? next() : res.status(403).json({ message: 'Không có quyền xét duyệt' });
const admin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Chỉ Admin được quản lý gói VIP' });
const orderFields = (order) => ({ id: order.id, code: order.transaction_code, status: order.status,
  userId: order.user_id, planId: order.plan_id, planName: order.plan_snapshot?.name,
  months: order.plan_snapshot?.months, amount: order.final_amount, bank: order.bank_snapshot,
  createdAt: order.created_at, submittedAt: order.submitted_at, reviewedAt: order.reviewed_at,
  reviewedBy: order.reviewed_by, rejectionReason: order.rejection_reason,
  vipStartDate: order.vip_start_date, vipEndDate: order.vip_end_date, history: order.history || [] });
const amountFor = (plan) => Number(plan.discount_price) > 0 ? Number(plan.discount_price) : Number(plan.price);
const availablePlans = async () => (await (await mongoCollection('subscription_plans')).find({}).sort({ display_order: 1 }).toArray())
  .filter((plan) => Boolean(plan.is_active) && billingMonths(plan) && Number.isSafeInteger(amountFor(plan)) && amountFor(plan) > 0);
const planDto = (plan) => ({ id: plan.id, name: plan.name, months: billingMonths(plan),
  price: Number(plan.price), discountPrice: Number(plan.discount_price), amount: amountFor(plan) });

vipPaymentRouter.use(requireAuth, mongoOnly);
vipPaymentAdminRouter.use(requireAuth, staff, mongoOnly);

vipPaymentRouter.get('/plans', asyncHandler(async (req, res) => {
  res.json({ plans: (await availablePlans()).map(planDto), bankMode: bankSettings().mode });
}));

vipPaymentRouter.get('/orders', asyncHandler(async (req, res) => {
  const orders = await (await mongoCollection('transactions')).find({ user_id: req.user.id, payment_method: 'bank_transfer' })
    .sort({ created_at: -1 }).limit(50).toArray();
  const user = await (await mongoCollection('users')).findOne({ id: req.user.id }, { projection: { vip_expires_at: 1 } });
  res.json({ orders: orders.map(orderFields), vipExpiresAt: user?.vip_expires_at || null });
}));

vipPaymentRouter.post('/orders', rateLimit({ windowMs: 15 * 60_000, limit: 5, keyGenerator: (req) => String(req.user.id),
  standardHeaders: 'draft-7', legacyHeaders: false }), asyncHandler(async (req, res) => {
  const planId = Number(req.body?.planId);
  if (!Number.isSafeInteger(planId)) return res.status(400).json({ message: 'Gói VIP không hợp lệ' });
  const plan = (await availablePlans()).find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ message: 'Gói VIP không tồn tại' });
  const transactions = await mongoCollection('transactions');
  const pending = await transactions.countDocuments({ user_id: req.user.id, payment_method: 'bank_transfer',
    status: { $in: ['PENDING', 'WAITING_REVIEW'] } });
  if (pending >= 2) return res.status(429).json({ message: 'Bạn đang có 2 đơn chưa hoàn tất' });
  const now = new Date();
  const id = await nextNumericId('transactions');
  const code = newOrderCode();
  const bank = bankSettings();
  const amount = amountFor(plan);
  const order = { _id: id, id, transaction_code: code, user_id: req.user.id, plan_id: plan.id,
    plan_snapshot: { name: plan.name, months: billingMonths(plan), price: Number(plan.price),
      discount_price: Number(plan.discount_price) }, amount: Number(plan.price),
    discount_amount: Number(plan.price) - amount, final_amount: amount,
    payment_method: 'bank_transfer', status: 'PENDING',
    bank_snapshot: { mode: bank.mode, bankName: bank.bankName, account: bank.account,
      accountName: bank.accountName, qrPayload: transferPayload({ bank, amount, code }) },
    created_at: now, history: [{ action: 'CREATED', actor_id: req.user.id, at: now }] };
  await transactions.insertOne(order);
  res.status(201).json({ order: orderFields(order) });
}));

vipPaymentRouter.post('/orders/:id/submit', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ message: 'Đơn không hợp lệ' });
  const now = new Date();
  const result = await (await mongoCollection('transactions')).findOneAndUpdate(
    { id, user_id: req.user.id, payment_method: 'bank_transfer', status: 'PENDING' },
    { $set: { status: 'WAITING_REVIEW', submitted_at: now },
      $push: { history: { action: 'SUBMITTED', actor_id: req.user.id, at: now } } },
    { returnDocument: 'after' });
  if (!result) return res.status(409).json({ message: 'Đơn không thuộc tài khoản hoặc đã gửi xét duyệt' });
  res.json({ order: orderFields(result) });
}));

vipPaymentAdminRouter.get('/orders', asyncHandler(async (req, res) => {
  const filter = { payment_method: 'bank_transfer' };
  if (['PENDING', 'WAITING_REVIEW', 'PAID', 'REJECTED'].includes(req.query.status)) filter.status = req.query.status;
  const search = String(req.query.search || '').trim().slice(0, 80);
  if (search) {
    const users = await (await mongoCollection('users')).find({ $or: [
      { username: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ] }, { projection: { id: 1 } }).limit(30).toArray();
    filter.$or = [{ transaction_code: search.toUpperCase() }, { user_id: { $in: users.map((user) => user.id) } }];
  }
  const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1));
  const collection = await mongoCollection('transactions');
  const [orders, total] = await Promise.all([collection.find(filter).sort({ created_at: -1 }).skip((page - 1) * 20).limit(20).toArray(), collection.countDocuments(filter)]);
  const users = await (await mongoCollection('users')).find({ id: { $in: orders.map((order) => order.user_id) } }, { projection: { id: 1, username: 1, email: 1 } }).toArray();
  const names = new Map(users.map((user) => [user.id, user]));
  res.json({ orders: orders.map((order) => ({ ...orderFields(order), username: names.get(order.user_id)?.username,
    email: names.get(order.user_id)?.email })), total, page });
}));

vipPaymentAdminRouter.post('/orders/:id/review', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const decision = req.body?.decision;
  const reason = String(req.body?.reason || '').trim();
  if (!Number.isSafeInteger(id) || !['approve', 'reject'].includes(decision)) return res.status(400).json({ message: 'Yêu cầu không hợp lệ' });
  if (decision === 'reject' && (reason.length < 5 || reason.length > 500)) return res.status(400).json({ message: 'Lý do từ chối cần 5–500 ký tự' });
  await ensureNotificationIndexes();
  const result = await withMongoTransaction(async (session) => {
    const transactions = await mongoCollection('transactions');
    const order = await transactions.findOne({ id, payment_method: 'bank_transfer', status: 'WAITING_REVIEW' }, { session });
    if (!order) return null;
    const now = new Date();
    const action = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    const update = { status: decision === 'approve' ? 'PAID' : 'REJECTED', reviewed_at: now,
      reviewed_by: req.user.id, rejection_reason: decision === 'reject' ? reason : null };
    let endDate;
    if (decision === 'approve') {
      const users = await mongoCollection('users');
      const user = await users.findOne({ id: order.user_id }, { session });
      if (!user) throw new Error('User not found');
      const existing = user.vip_expires_at ? new Date(user.vip_expires_at) : null;
      const base = existing && existing > now ? existing : now;
      endDate = addCalendarMonths(base, order.plan_snapshot.months);
      await users.updateOne({ id: order.user_id }, { $set: { vip_expires_at: endDate } }, { session });
      update.vip_start_date = base;
      update.vip_end_date = endDate;
      const subId = await nextNumericId('user_subscriptions');
      await (await mongoCollection('user_subscriptions')).insertOne({ _id: subId, id: subId,
        user_id: order.user_id, plan_id: order.plan_id, transaction_id: id,
        start_date: base, end_date: endDate, status: 'active', auto_renew: 0, created_at: now }, { session });
    }
    const changed = await transactions.updateOne({ id, status: 'WAITING_REVIEW' },
      { $set: update, $push: { history: { action, actor_id: req.user.id, at: now, reason: reason || null } } }, { session });
    if (!changed.modifiedCount) return null;
    const notification = await createNotification({ recipientId: order.user_id, type: 'vip',
      title: decision === 'approve' ? 'Đơn VIP đã được duyệt' : 'Đơn VIP bị từ chối',
      message: decision === 'approve' ? `Gói ${order.plan_snapshot.name} có hiệu lực đến ${endDate.toLocaleDateString('vi-VN')}.` : `Đơn ${order.transaction_code} bị từ chối: ${reason}`,
      entityType: 'transaction', entityId: id, redirectUrl: '/vip',
      deduplicationKey: `vip-payment:${id}:${action}`, session });
    return { order: { ...order, ...update }, notification };
  });
  if (!result) return res.status(409).json({ message: 'Đơn không còn chờ xét duyệt' });
  emitStoredNotification(result.notification);
  res.json({ order: orderFields(result.order) });
}));

vipPaymentAdminRouter.put('/plans/:id', admin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const months = Number(req.body?.months);
  const price = Number(req.body?.price);
  const discountPrice = Number(req.body?.discountPrice);
  if (!Number.isSafeInteger(id) || ![1, 12].includes(months) || !Number.isSafeInteger(price) || price <= 0 || price > 100_000_000
    || !Number.isSafeInteger(discountPrice) || discountPrice < 0 || discountPrice > price) return res.status(400).json({ message: 'Giá hoặc thời hạn không hợp lệ' });
  const plans = await mongoCollection('subscription_plans');
  const plan = await plans.findOne({ id });
  if (!plan || !billingMonths(plan)) return res.status(404).json({ message: 'Gói không hợp lệ' });
  await plans.updateOne({ id }, { $set: { billing_months: months, duration_days: months === 1 ? 30 : 365,
    price, discount_price: discountPrice, updated_at: new Date(), updated_by: req.user.id } });
  res.json({ plan: planDto({ ...plan, billing_months: months, price, discount_price: discountPrice }) });
}));
