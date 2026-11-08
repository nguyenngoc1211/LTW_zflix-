import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import { Server } from 'socket.io';

const uri = process.env.NOTIFICATION_TEST_MONGODB_URI || '';
const parsed = new URL(uri || 'mongodb://invalid/');
if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
  parsed.port !== '27018' || uri.includes('@')) throw new Error('Local isolated MongoDB on port 27018 required');
const dbName = `notification_p1_test_${Date.now()}`;
process.env.NODE_ENV = 'test';
process.env.DATA_STORE = 'mongodb';
process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = dbName;
process.env.JWT_ACCESS_SECRET = 'notification-p1-test-only-secret-with-thirty-two-characters';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const { default: app } = await import('../src/app.js');
const { closeMongo } = await import('../src/core/database/mongo.js');
const { authenticateSocket } = await import('../src/modules/watch-party/watch-party.socket.js');
const { setNotificationNamespace, createNotification } = await import('../src/modules/community/notification.service.js');
const { processEpisodeNotificationJobs } = await import('../src/modules/community/episode-notification.job.js');
const { processExpiredVipNotifications } = await import('../src/modules/community/vip-expiration.job.js');
const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { io: connectSocket } = frontendRequire('socket.io-client');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const server = createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:5173' } });
const namespace = io.of('/notifications');
namespace.use(authenticateSocket);
namespace.on('connection', (socket) => socket.join(`user:${socket.data.userId}`));
setNotificationNamespace(namespace);
const A = 800001, B = 800002, C = 800003, D = 800004;
const token = (id) => jwt.sign({ sid: `p1-session-${id}` }, process.env.JWT_ACCESS_SECRET,
  { subject: String(id), algorithm: 'HS256' });
const auth = (id) => ({ Authorization: `Bearer ${token(id)}` });
const count = (db, user, type) => db.collection('notifications').countDocuments({ user_id: user, type });
let socket;
let viteProcess;
let browser;
try {
  await client.connect();
  assert.equal((await client.db('admin').command({ hello: 1 })).setName, 'rs0');
  const db = client.db(dbName);
  await db.collection('users').insertMany([
    [A, 'alice_test', 'user'], [B, 'bob_test', 'user'], [C, 'carol_test', 'admin'], [D, 'dave_test', 'user'],
  ].map(([id, username, role]) => ({ _id: id, id, username, status: 'active', role })));
  const until = new Date(Date.now() + 3600000);
  await db.collection('auth_sessions').insertMany([A, B, C, D].map((id) => ({
    _id: `p1-session-${id}`, id: `p1-session-${id}`, user_id: id, revoked_at: null, expires_at: until, absolute_expires_at: until,
  })));
  await db.collection('productions').insertOne({ _id: 800010, id: 800010, title: 'P1 film', status: 'ongoing' });
  await db.collection('episodes').insertOne({ _id: 800011, id: 800011, production_id: 800010, episode_number: 1, video_url: '/old.m3u8' });
  await db.collection('watch_history').insertOne({ _id: 'history-A', user_id: A, episode_id: 800011 });
  await db.collection('bookmarks').insertOne({ _id: 'bookmark-A', user_id: A, production_id: 800010 });
  await db.collection('production_interests').insertOne({ _id: 'follow-B', user_id: B, production_id: 800010 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  socket = connectSocket(`${base}/notifications`, { auth: { token: token(A) }, transports: ['websocket'] });
  await Promise.race([once(socket, 'connect'), new Promise((_, reject) => setTimeout(() => reject(new Error('Socket timeout')), 5000))]);
  const events = [];
  socket.on('notification:new', (item) => events.push(item));

  const defaults = await request(server).get('/api/v1/notifications/preferences').set(auth(A));
  assert.equal(defaults.status, 200);
  assert.equal(defaults.body.preferences.likes, true);
  assert.equal((await request(server).patch('/api/v1/notifications/preferences').set(auth(A)).send({ likes: 'false' })).status, 400);
  assert.equal((await request(server).patch('/api/v1/notifications/preferences').set(auth(A)).send({ userId: B, likes: false })).status, 400);
  assert.equal((await request(server).patch('/api/v1/notifications/preferences').set(auth(A)).send({ likes: false, episode_updates: false })).status, 200);
  assert.equal((await request(server).get('/api/v1/notifications/preferences').set(auth(B))).body.preferences.likes, true);
  for (const key of Object.keys(defaults.body.preferences)) {
    assert.equal((await request(server).patch('/api/v1/notifications/preferences').set(auth(B)).send({ [key]: false })).body.preferences[key], false);
    assert.equal((await request(server).patch('/api/v1/notifications/preferences').set(auth(B)).send({ [key]: true })).body.preferences[key], true);
  }
  console.log('PASS preferences defaults, validation and owner isolation');

  const suggestions = await request(server).get('/api/v1/users/mention-suggestions?q=bob').set(auth(A));
  assert.equal(suggestions.status, 200);
  assert.deepEqual(suggestions.body.items.map((item) => item.username), ['bob_test']);
  assert.ok(!('email' in suggestions.body.items[0]));
  const postKey = randomUUID();
  const postBody = { title: 'Mentions', content: '@bob_test @bob_test @carol_test @alice_test @missing_test <script>alert(1)</script>' };
  const post = await request(server).post('/api/v1/community/posts').set(auth(A)).set('Idempotency-Key', postKey).send(postBody);
  assert.equal(post.status, 201, JSON.stringify(post.body));
  const postRetry = await request(server).post('/api/v1/community/posts').set(auth(A)).set('Idempotency-Key', postKey).send(postBody);
  assert.equal(postRetry.status, 200);
  assert.equal(postRetry.body.id, post.body.id);
  assert.equal(await count(db, B, 'mention'), 1);
  assert.equal(await count(db, C, 'mention'), 1);
  assert.equal(await count(db, A, 'mention'), 0);
  assert.deepEqual(new Set(post.body.mention_user_ids), new Set([A, B, C]));
  const commentKey = randomUUID();
  const reply = await request(server).post(`/api/v1/community/posts/${post.body.id}/comments`).set(auth(B))
    .set('Idempotency-Key', commentKey).send({ content: '@alice_test reply mention' });
  assert.equal(reply.status, 201);
  assert.equal((await request(server).post(`/api/v1/community/posts/${post.body.id}/comments`).set(auth(B))
    .set('Idempotency-Key', commentKey).send({ content: '@alice_test reply mention' })).status, 200);
  assert.equal(await count(db, A, 'post_comment'), 1);
  assert.equal(await count(db, A, 'mention'), 0);
  assert.ok(events.some((item) => item.type === 'post_comment'));
  console.log('PASS mention lookup, duplicate/self/unknown names, HTML text, reply overlap and realtime');

  const path = `/api/v1/community/posts/${post.body.id}/vote`;
  assert.equal((await request(server).put(path).set(auth(B)).send({ value: 1 })).status, 200);
  assert.equal(await count(db, A, 'like'), 0, 'likes preference is off');
  await request(server).patch('/api/v1/notifications/preferences').set(auth(A)).send({ likes: true });
  await request(server).put(path).set(auth(B)).send({ value: 0 });
  await request(server).put(path).set(auth(B)).send({ value: 1 });
  assert.equal(await count(db, A, 'like'), 1);
  await request(server).put(path).set(auth(B)).send({ value: 0 });
  await request(server).put(path).set(auth(B)).send({ value: 1 });
  assert.equal(await count(db, A, 'like'), 0, 'rapid unlike/like must not create a second alert');
  await request(server).put(path).set(auth(C)).send({ value: 1 });
  const like = await db.collection('notifications').findOne({ user_id: A, type: 'like' });
  assert.equal(like.metadata.likeCount, 2);
  assert.equal(await count(db, A, 'like'), 1);
  assert.equal((await request(server).patch(`/api/v1/notifications/${like.id}/read`).set(auth(A))).status, 204);
  await request(server).put(path).set(auth(D)).send({ value: 1 });
  const aggregated = await db.collection('notifications').findOne({ user_id: A, type: 'like' });
  assert.equal(aggregated.id, like.id);
  assert.equal(aggregated.metadata.likeCount, 3);
  assert.equal(aggregated.is_read, 0);
  assert.equal((await request(server).get('/api/v1/notifications/unread-count').set(auth(A))).body.unread,
    await db.collection('notifications').countDocuments({ user_id: A, is_read: 0 }));
  await request(server).put(path).set(auth(A)).send({ value: 1 });
  assert.equal(await count(db, A, 'like'), 1);
  const ownComment = await request(server).post(`/api/v1/community/posts/${post.body.id}/comments`).set(auth(A))
    .set('Idempotency-Key', randomUUID()).send({ content: 'Own comment to like' });
  assert.equal(ownComment.status, 201);
  assert.equal((await request(server).put(`/api/v1/community/posts/${post.body.id}/comments/${ownComment.body.id}/vote`)
    .set(auth(B)).send({ value: 1 })).status, 200);
  assert.equal(await count(db, A, 'like'), 2);
  const movieComment = await request(server).post('/api/v1/productions/800010/comments').set(auth(A))
    .set('Idempotency-Key', randomUUID()).send({ content: 'Movie comment @carol_test' });
  assert.equal(movieComment.status, 201);
  assert.equal(await count(db, C, 'mention'), 2);
  assert.equal((await request(server).put(`/api/v1/comments/${movieComment.body.id}/vote`).set(auth(B)).send({ value: 1 })).status, 200);
  assert.equal(await count(db, A, 'like'), 3);
  console.log('PASS like preference, cooldown, aggregate, self-like and unread count');

  await createNotification({ recipientId: A, type: 'security', title: 'Security', message: 'Required',
    entityType: 'user', entityId: A, redirectUrl: '/settings?tab=security', deduplicationKey: 'p1-security-A' });
  assert.equal(await count(db, A, 'security'), 1);
  const batchId = 'p1-release-001';
  const first = await request(server).post('/api/v1/admin/productions/800010/episodes').set(auth(C))
    .send({ episodeNumber: 2, title: 'Episode 2', videoUrl: '/2.m3u8', publicationBatchId: batchId });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  await processEpisodeNotificationJobs();
  assert.equal(await count(db, B, 'new_episode'), 0, 'open batch should not publish');
  const second = await request(server).post('/api/v1/admin/productions/800010/episodes').set(auth(C))
    .send({ episodeNumber: 3, title: 'Episode 3', videoUrl: '/3.m3u8', publicationBatchId: batchId, publicationBatchComplete: true });
  assert.equal(second.status, 201, JSON.stringify(second.body));
  await processEpisodeNotificationJobs();
  assert.equal(await count(db, A, 'new_episode'), 0, 'episode preference is off');
  assert.equal(await count(db, B, 'new_episode'), 1);
  const episodeNotice = await db.collection('notifications').findOne({ user_id: B, type: 'new_episode' });
  assert.equal(episodeNotice.metadata.episodeCount, 2);
  assert.equal(episodeNotice.redirect_url, `/watch-episode/${second.body.id}`);
  await db.collection('notification_jobs').updateOne({ _id: `episode-batch:800010:${batchId}` },
    { $set: { status: 'pending' } });
  await processEpisodeNotificationJobs();
  assert.equal(await count(db, B, 'new_episode'), 1);
  const late = await request(server).post('/api/v1/admin/productions/800010/episodes').set(auth(C))
    .send({ episodeNumber: 4, title: 'Late episode', videoUrl: '/4.m3u8', publicationBatchId: batchId });
  assert.equal(late.status, 409);
  assert.equal(await db.collection('episodes').countDocuments({ production_id: 800010, episode_number: 4 }), 0);
  console.log('PASS explicit episode batch, opt-out, recipient deduplication and retry');

  const vip7 = new Date(Date.now() + 6 * 86400000);
  await db.collection('users').updateOne({ id: D }, { $set: { vip_expires_at: vip7 } });
  await db.collection('user_subscriptions').insertOne({ _id: 800020, id: 800020, user_id: D, status: 'active', end_date: vip7 });
  await processExpiredVipNotifications();
  assert.equal(await count(db, D, 'vip_reminder'), 1);
  const renewed = new Date(Date.now() + 30 * 86400000);
  await db.collection('users').updateOne({ id: D }, { $set: { vip_expires_at: renewed } });
  await db.collection('user_subscriptions').insertOne({ _id: 800022, id: 800022, user_id: D, status: 'active', end_date: renewed });
  await processExpiredVipNotifications();
  assert.equal(await count(db, D, 'vip_reminder'), 1, 'manual renewal must use the new expiry');
  await processExpiredVipNotifications();
  assert.equal(await count(db, D, 'vip_reminder'), 1);
  const vip1 = new Date(Date.now() + 12 * 3600000);
  await db.collection('users').updateOne({ id: D }, { $set: { vip_expires_at: vip1 } });
  await db.collection('user_subscriptions').insertOne({ _id: 800021, id: 800021, user_id: D, status: 'active', end_date: vip1 });
  await processExpiredVipNotifications();
  assert.equal(await count(db, D, 'vip_reminder'), 2);
  await db.collection('user_subscriptions').updateOne({ id: 800021 }, { $set: { status: 'cancelled' } });
  await db.collection('users').updateOne({ id: D }, { $set: { vip_expires_at: new Date(Date.now() + 4 * 3600000) } });
  await processExpiredVipNotifications();
  assert.equal(await count(db, D, 'vip_reminder'), 2);
  const expired = new Date(Date.now() - 1000);
  await db.collection('users').updateOne({ id: D }, { $set: { vip_expires_at: expired } });
  await processExpiredVipNotifications();
  assert.equal(await count(db, D, 'vip_expired'), 1);
  await processExpiredVipNotifications();
  assert.equal(await count(db, D, 'vip_expired'), 1);
  console.log('PASS VIP 7-day/1-day reminders, cancellation, expiration and job retry');

  if (process.env.NOTIFICATION_UI_SMOKE === '1') {
    const { chromium } = frontendRequire('playwright-core');
    const frontendDirectory = new URL('../../frontend/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
    const viteScript = new URL('../../frontend/node_modules/vite/bin/vite.js', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
    viteProcess = spawn(process.execPath, [viteScript, '--host', 'localhost', '--port', '5173', '--strictPort'], {
      cwd: frontendDirectory, env: { ...process.env, VITE_API_URL: base }, windowsHide: true, stdio: 'ignore',
    });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { ready = (await fetch('http://localhost:5173/')).ok; } catch { /* wait */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Vite did not start');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
    const page = await browser.newPage();
    await page.route('**/api/v1/auth/refresh-token', (route) => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ accessToken: token(A), user: { id: A, username: 'alice_test', role: 'user' } }) }));
    await page.goto('http://localhost:5173/settings?tab=notifications');
    const mentionToggle = page.locator('.notification-preference-row').filter({ hasText: 'Nhắc đến tôi' }).locator('input');
    await mentionToggle.waitFor();
    await mentionToggle.uncheck();
    await page.locator('.notification-preferences [role="status"]').waitFor();
    assert.equal((await db.collection('users').findOne({ id: A })).notification_preferences.mentions, false);
    await page.goto('http://localhost:5173/community/create');
    const composer = page.locator('textarea').first();
    await composer.fill('Hello @bob');
    await page.getByRole('option', { name: '@bob_test' }).click();
    assert.ok((await composer.inputValue()).includes('@bob_test '));
    await page.goto('http://localhost:5173/notifications');
    await page.locator('.notification-list').getByText('Lượt thích mới').first().waitFor();
    console.log('PASS browser preferences, mention autocomplete and P1 notification list');
  }
} finally {
  if (browser) await browser.close();
  if (viteProcess) viteProcess.kill();
  socket?.disconnect();
  await new Promise((resolve) => io.close(resolve));
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await closeMongo();
  await client.db(dbName).dropDatabase().catch(() => {});
  await client.close();
}
