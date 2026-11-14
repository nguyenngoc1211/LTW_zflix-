import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoClient } from 'mongodb';
import { Server } from 'socket.io';

const uri = process.env.NOTIFICATION_TEST_MONGODB_URI || '';
const parsed = new URL(uri || 'mongodb://invalid/');
if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)
    || parsed.port !== '27018' || uri.includes('@')) throw new Error('A local, isolated MongoDB test URI on port 27018 is required');
const dbName = `notification_test_${Date.now()}`;
process.env.NODE_ENV = 'test';
process.env.DATA_STORE = 'mongodb';
process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = dbName;
process.env.JWT_ACCESS_SECRET = 'notification-test-only-secret-with-thirty-two-characters';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const { default: app } = await import('../src/app.js');
const { closeMongo } = await import('../src/core/database/mongo.js');
const { authenticateSocket } = await import('../src/modules/watch-party/watch-party.socket.js');
const { setNotificationNamespace } = await import('../src/modules/community/notification.service.js');
const { queueEpisodeNotification, processEpisodeNotificationJobs } = await import('../src/modules/community/episode-notification.job.js');
const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { io: connectSocket } = frontendRequire('socket.io-client');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const server = createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:5173' } });
const namespace = io.of('/notifications');
namespace.use(authenticateSocket);
namespace.on('connection', (socket) => socket.join(`user:${socket.data.userId}`));
setNotificationNamespace(namespace);
const sockets = [];
let viteProcess;
let browser;
const A = 700001, B = 700002, C = 700003, productionId = 700010, oldEpisodeId = 700011, postId = 700012;
const sessionId = (id) => `notification-test-session-${id}`;
const issuedTokens = new Map();
const token = (id) => issuedTokens.get(id) || jwt.sign({ sid: sessionId(id) }, process.env.JWT_ACCESS_SECRET, { subject: String(id), algorithm: 'HS256' });
const auth = (id) => ({ Authorization: `Bearer ${token(id)}` });
const connect = async (id, base) => {
  const socket = connectSocket(`${base}/notifications`, { auth: { token: token(id) }, transports: ['websocket'] });
  sockets.push(socket);
  await Promise.race([once(socket, 'connect'), new Promise((_, reject) => setTimeout(() => reject(new Error('Socket timeout')), 5000))]);
  return socket;
};
const sendComment = (api, id, path, body, key = randomUUID()) =>
  request(api).post(path).set(auth(id)).set('Idempotency-Key', key).send(body);
const notifications = (db, userId, type) => db.collection('notifications').find({ user_id: userId, type }).toArray();

try {
  await client.connect();
  const hello = await client.db('admin').command({ hello: 1 });
  assert.equal(hello.setName, 'rs0', 'MongoDB transactions require a replica set');
  const db = client.db(dbName);
  const until = new Date(Date.now() + 3600000);
  const password = 'notification-test-password-123';
  const passwordHash = await bcrypt.hash(password, 10);
  await db.collection('users').insertMany([A, B, C].map((id) => ({ _id: id, id, username: `notification_user_${id}`, email: `${id}@example.invalid`, password: passwordHash, provider: 'local', role: id === C ? 'admin' : 'user', status: 'active' })));
  await db.collection('auth_sessions').insertMany([A, B, C].map((id) => ({ _id: sessionId(id), id: sessionId(id), user_id: id, refresh_token_hash: `notification-fixture-${id}`, revoked_at: null, expires_at: until, absolute_expires_at: until })));
  await db.collection('productions').insertOne({ _id: productionId, id: productionId, title: 'Notification Test Film', type: 'movie', status: 'ongoing', slug: 'notification-test-film' });
  await db.collection('episodes').insertOne({ _id: oldEpisodeId, id: oldEpisodeId, production_id: productionId, episode_number: 1, title: 'Old episode', video_url: '/old.m3u8' });
  await db.collection('community_posts').insertOne({ _id: postId, id: postId, author_id: A, title: 'Notification Test Post', content: 'Test post', type: 'normal', content_type: 'community_post', visibility: 'public', status: 'active', comment_count: 0, created_at: new Date() });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const id of [A, B]) {
    const login = await request(server).post('/api/v1/auth/login').send({ email: `${id}@example.invalid`, password });
    assert.equal(login.status, 200);
    assert.ok(login.body.accessToken);
    issuedTokens.set(id, login.body.accessToken);
  }
  console.log('PASS two account logins');
  const socketA = await connect(A, base);
  const socketB = await connect(B, base);
  const invalidSocket = connectSocket(`${base}/notifications`, { auth: { token: 'invalid' }, transports: ['websocket'] });
  await Promise.race([once(invalidSocket, 'connect_error'), new Promise((_, reject) => setTimeout(() => reject(new Error('Invalid socket was not rejected')), 5000))]);
  assert.equal(invalidSocket.connected, false);
  invalidSocket.disconnect();
  const receivedA = [], receivedB = [];
  socketA.on('notification:new', (item) => receivedA.push(item));
  socketB.on('notification:new', (item) => receivedB.push(item));

  const moviePath = `/api/v1/productions/${productionId}/comments`;
  const root = await sendComment(server, A, moviePath, { content: 'Root comment', episodeId: oldEpisodeId });
  assert.equal(root.status, 201);
  const replyKey = randomUUID();
  const replyBody = { content: 'Reply to A', parentId: root.body.id };
  const reply = await sendComment(server, B, moviePath, replyBody, replyKey);
  assert.equal(reply.status, 201);
  assert.equal((await sendComment(server, B, moviePath, replyBody, replyKey)).body.id, reply.body.id);
  assert.equal((await sendComment(server, B, moviePath, { ...replyBody, content: 'Different payload' }, replyKey)).status, 409);
  assert.equal((await notifications(db, A, 'comment_reply')).length, 1);
  assert.equal((await notifications(db, A, 'comment_reply'))[0].redirect_url, `/watch-episode/${oldEpisodeId}?commentId=${reply.body.id}`);
  assert.equal((await db.collection('comments').findOne({ id: reply.body.id })).episode_id, oldEpisodeId);
  assert.equal((await db.collection('comments').countDocuments({ request_key: `${B}:${replyKey}` })), 1);
  assert.equal(receivedA.length, 1);
  assert.equal(receivedB.length, 0);
  assert.equal((await sendComment(server, A, moviePath, { content: 'Self reply', parentId: root.body.id })).status, 201);
  assert.equal((await notifications(db, A, 'comment_reply')).length, 1);
  const nested = await sendComment(server, C, moviePath, { content: 'Reply to B', parentId: reply.body.id });
  assert.equal(nested.status, 201);
  assert.equal((await notifications(db, B, 'comment_reply')).length, 1);
  assert.equal((await notifications(db, A, 'comment_reply')).length, 1);
  console.log('PASS comment reply, self reply, nested reply, retry and realtime routing');

  const postPath = `/api/v1/community/posts/${postId}/comments`;
  const postComment = await sendComment(server, B, postPath, { content: 'Direct post comment' });
  assert.equal(postComment.status, 201);
  assert.equal((await notifications(db, A, 'post_comment')).length, 1);
  const context = await request(server).get(`${postPath}/${postComment.body.id}/context`).set(auth(A));
  assert.equal(context.status, 200);
  assert.equal(context.body.path.at(-1).id, postComment.body.id);
  const postReply = await sendComment(server, C, postPath, { content: 'Reply to B in post', parentId: postComment.body.id });
  assert.equal(postReply.status, 201);
  assert.equal((await notifications(db, B, 'comment_reply')).length, 2);
  assert.equal((await notifications(db, A, 'comment_reply')).length, 1);
  console.log('PASS post comments and deep link context');

  const countBefore = await request(server).get('/api/v1/notifications/unread-count').set(auth(A));
  assert.equal(countBefore.body.unread, 2);
  const foreignId = (await notifications(db, B, 'comment_reply'))[0].id;
  assert.equal((await request(server).patch(`/api/v1/notifications/${foreignId}/read`).set(auth(A))).status, 404);
  assert.equal((await request(server).delete(`/api/v1/notifications/${foreignId}`).set(auth(A))).status, 404);
  const ownId = (await notifications(db, A, 'comment_reply'))[0].id;
  assert.equal((await request(server).patch(`/api/v1/notifications/${ownId}/read`).set(auth(A))).status, 204);
  assert.equal((await request(server).get('/api/v1/notifications/unread-count').set(auth(A))).body.unread, 1);
  assert.equal((await request(server).get('/api/v1/notifications?filter=unread').set(auth(A))).body.items.length, 1);
  console.log('PASS ownership, unread count and filter');

  await db.collection('watch_history').insertOne({ _id: 'notification-test-history-a', user_id: A, episode_id: oldEpisodeId });
  await db.collection('bookmarks').insertOne({ _id: 'notification-test-bookmark-a', user_id: A, production_id: productionId });
  await db.collection('production_interests').insertOne({ _id: 'notification-test-interest-b', user_id: B, production_id: productionId });
  const published = await request(server).post(`/api/v1/admin/productions/${productionId}/episodes`).set(auth(C))
    .send({ episodeNumber: 2, title: 'New episode', videoUrl: '/new.m3u8' });
  assert.equal(published.status, 201);
  const newEpisodeId = published.body.id;
  assert.equal(await db.collection('notification_jobs').countDocuments({ _id: `episode:${newEpisodeId}` }), 1);
  await processEpisodeNotificationJobs();
  assert.equal((await notifications(db, A, 'new_episode')).length, 1);
  assert.equal((await notifications(db, B, 'new_episode')).length, 1);
  const jobs = db.collection('notification_jobs');
  await jobs.updateOne({ _id: `episode:${newEpisodeId}` }, { $set: { status: 'running', claim_token: 'abandoned', lease_until: new Date(Date.now() - 1000) } });
  await Promise.all([processEpisodeNotificationJobs(), processEpisodeNotificationJobs()]);
  assert.equal((await jobs.findOne({ _id: `episode:${newEpisodeId}` })).status, 'done');
  assert.equal((await notifications(db, A, 'new_episode')).length, 1);
  await jobs.updateOne({ _id: `episode:${newEpisodeId}` }, { $set: { status: 'pending', next_retry_at: new Date(Date.now() + 60000) } });
  await processEpisodeNotificationJobs();
  assert.equal((await jobs.findOne({ _id: `episode:${newEpisodeId}` })).status, 'pending');
  await jobs.updateOne({ _id: `episode:${newEpisodeId}` }, { $set: { next_retry_at: new Date(Date.now() - 1000) } });
  await processEpisodeNotificationJobs();
  assert.equal((await jobs.findOne({ _id: `episode:${newEpisodeId}` })).status, 'done');
  assert.equal((await notifications(db, C, 'new_episode')).length, 0);
  assert.equal((await notifications(db, A, 'new_episode'))[0].redirect_url, `/watch-episode/${newEpisodeId}`);
  await db.collection('notification_jobs').updateOne({ _id: `episode:${newEpisodeId}` }, { $set: { status: 'pending' } });
  await processEpisodeNotificationJobs();
  assert.equal((await notifications(db, A, 'new_episode')).length, 1);
  assert.equal((await notifications(db, B, 'new_episode')).length, 1);
  for (const [id, status] of [[700015, 'draft'], [700016, 'hidden']]) {
    await db.collection('episodes').insertOne({ _id: id, id, production_id: productionId, episode_number: id - 700010, title: status, video_url: `/${status}.m3u8`, status });
    await queueEpisodeNotification({ episodeId: id, productionId });
    await processEpisodeNotificationJobs();
  }
  assert.equal((await notifications(db, A, 'new_episode')).length, 1);
  assert.equal((await notifications(db, B, 'new_episode')).length, 1);
  await db.collection('episodes').updateOne({ id: oldEpisodeId }, { $set: { title: 'Edited old episode' } });
  await db.collection('episodes').insertOne({ _id: 700014, id: 700014, production_id: productionId, episode_number: 0, title: 'Historical import', video_url: '/old-import.m3u8' });
  assert.equal(await db.collection('notification_jobs').countDocuments({}), 3);
  console.log('PASS episode recipients, deduplication, retry, old edit and import exclusion');

  const securityBefore = await db.collection('notifications').countDocuments({ user_id: A, type: 'security' });
  const badPassword = await request(server).post('/api/v1/auth/change-password').set(auth(A)).set('Origin', 'http://localhost:5173')
    .send({ currentPassword: 'wrong-password', newPassword: 'new-password-123' });
  assert.equal(badPassword.status, 400);
  assert.equal(await db.collection('notifications').countDocuments({ user_id: A, type: 'security' }), securityBefore);
  console.log('PASS failed security update creates no notification');

  socketA.disconnect();
  const offlineComment = await sendComment(server, B, moviePath, { content: 'Offline reply', parentId: root.body.id });
  assert.equal(offlineComment.status, 201);
  assert.equal((await notifications(db, A, 'comment_reply')).length, 2);
  const tabOne = await connect(A, base);
  const tabTwo = await connect(A, base);
  const tabEvents = [0, 0];
  tabOne.on('notification:new', () => { tabEvents[0] += 1; });
  tabTwo.on('notification:new', () => { tabEvents[1] += 1; });
  const multiTab = await sendComment(server, B, moviePath, { content: 'Multi tab reply', parentId: root.body.id });
  assert.equal(multiTab.status, 201);
  assert.deepEqual(tabEvents, [1, 1]);
  assert.equal((await notifications(db, A, 'comment_reply')).length, 3);
  console.log('PASS offline persistence, reconnect and multi tab');

  if (process.env.NOTIFICATION_UI_SMOKE === '1') {
    const { chromium } = frontendRequire('playwright-core');
    const frontendDirectory = new URL('../../frontend/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
    const viteScript = new URL('../../frontend/node_modules/vite/bin/vite.js', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '');
    viteProcess = spawn(process.execPath, [viteScript, '--host', 'localhost', '--port', '5173', '--strictPort'], {
      cwd: frontendDirectory, env: { ...process.env, VITE_API_URL: base }, windowsHide: true, stdio: 'ignore',
    });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { ready = (await fetch('http://localhost:5173/')).ok; } catch { /* Wait for Vite. */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Vite did not start');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
    const page = await browser.newPage();
    await page.route('**/api/v1/auth/refresh-token', (route) => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ accessToken: token(A), user: { id: A, username: `notification_user_${A}`, role: 'user' } }) }));
    await page.goto('http://localhost:5173/notifications');
    await page.getByRole('heading', { name: /Thông báo/ }).waitFor();
    await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
    await page.getByText('Xem tất cả thông báo').waitFor();
    assert.ok(await page.locator('.notification-preview').count() > 0);
    await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
    await page.getByRole('button', { name: 'Bình luận', exact: true }).click();
    await page.getByText('Multi tab reply').waitFor();
    await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click();
    await page.locator('.notification-list article').first().waitFor();
    assert.ok(await page.locator('.notification-list article').count() > 0);
    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).first().click();
    await page.getByText('Chưa có thông báo trong mục này.').waitFor();
    await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
    await page.getByRole('button', { name: 'Phim', exact: true }).click();
    await page.getByText('Notification Test Film').waitFor();
    await page.locator('.notification-list .notification-content').first().click();
    await page.waitForURL(new RegExp(`/movies/${productionId}\\?ep=2`));
    await page.goto('http://localhost:5173/notifications');
    await page.getByRole('button', { name: 'Bình luận', exact: true }).click();
    await page.getByText('Direct post comment').waitFor();
    await page.locator('.notification-content').filter({ hasText: 'Direct post comment' }).click();
    await page.waitForURL(new RegExp(`/community/posts/${postId}\\?commentId=${postComment.body.id}`));
    await page.locator(`#post-comment-${postComment.body.id}`).waitFor();
    await page.goto(`http://localhost:5173/community/posts/${postId}?commentId=${postReply.body.id}`);
    await page.locator(`#post-comment-${postReply.body.id}`).waitFor();
    await page.goto(`http://localhost:5173/watch-episode/${oldEpisodeId}?commentId=${reply.body.id}`);
    await page.waitForURL(new RegExp(`/movies/${productionId}\\?ep=1&commentId=${reply.body.id}`));
    await page.locator(`#movie-comment-${reply.body.id}`).waitFor();
    assert.ok(await page.locator(`#movie-comment-${reply.body.id}`).evaluate((element) => element.classList.contains('notification-target')));
    assert.equal(await page.locator('video').first().evaluate((video) => video.paused && !video.autoplay), true);
    await page.reload();
    await page.locator(`#movie-comment-${reply.body.id}`).waitFor();
    assert.equal(await page.locator('video').first().evaluate((video) => video.paused && !video.autoplay), true);
    console.log('PASS browser bell, dropdown, filters, unread count, mark-all and deep links');
  }
  const changedPassword = await request(server).post('/api/v1/auth/change-password').set(auth(A)).set('Origin', 'http://localhost:5173')
    .send({ currentPassword: password, newPassword: 'new-notification-password-456' });
  assert.equal(changedPassword.status, 200);
  assert.equal(await db.collection('notifications').countDocuments({ user_id: A, type: 'security' }), 1);
  assert.equal((await request(server).get('/api/v1/notifications').set(auth(A))).status, 401);
  console.log('PASS successful security update is persisted and revokes the previous session');
} finally {
  if (browser) await browser.close();
  if (viteProcess) viteProcess.kill();
  sockets.forEach((socket) => socket.disconnect());
  await new Promise((resolve) => io.close(resolve));
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await closeMongo();
  await client.db(dbName).dropDatabase().catch(() => {});
  await client.close();
}
