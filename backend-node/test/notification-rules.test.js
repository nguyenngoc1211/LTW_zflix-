import test from 'node:test';
import assert from 'node:assert/strict';
import { directCommentRecipient } from '../src/modules/community/notification.service.js';
import { isPublishableEpisode } from '../src/modules/community/episode-notification.job.js';
import request from 'supertest';
import { commentRequestIdentity, existingCommentForRequest } from '../src/modules/community/comment-idempotency.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db';
process.env.JWT_ACCESS_SECRET ||= 'test-only-secret-with-at-least-thirty-two-characters';
process.env.FRONTEND_ORIGIN ||= 'http://localhost:5173';
process.env.MFA_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString('base64');
const { default: app } = await import('../src/app.js');

test('a direct reply targets only the parent author', () => {
  assert.equal(directCommentRecipient({ parentId: 10, parentAuthorId: 1, postAuthorId: 3, actorId: 2 }), 1);
  assert.equal(directCommentRecipient({ parentId: 20, parentAuthorId: 2, postAuthorId: 1, actorId: 3 }), 2);
});

test('self replies and self post comments have no recipient', () => {
  assert.equal(directCommentRecipient({ parentId: 10, parentAuthorId: 1, postAuthorId: 2, actorId: 1 }), null);
  assert.equal(directCommentRecipient({ parentId: null, parentAuthorId: null, postAuthorId: 1, actorId: 1 }), null);
});

test('a direct post comment targets the post author', () => {
  assert.equal(directCommentRecipient({ parentId: null, postAuthorId: 1, actorId: 2 }), 1);
});

test('only a visible episode with playable video is publishable', () => {
  assert.equal(isPublishableEpisode({ video_url: '/media/new.m3u8' }), true);
  assert.equal(isPublishableEpisode({ video_url: null }), false);
  assert.equal(isPublishableEpisode({ video_url: '/media/new.m3u8', status: 'draft' }), false);
  assert.equal(isPublishableEpisode({ video_url: '/media/new.m3u8', status: 'hidden' }), false);
});

test('notification endpoints reject unauthenticated access without touching a database', async () => {
  for (const [method, path] of [
    ['get', '/api/v1/notifications'], ['get', '/api/v1/notifications/unread-count'],
    ['patch', '/api/v1/notifications/1/read'], ['patch', '/api/v1/notifications/read-all'],
    ['delete', '/api/v1/notifications/1'],
  ]) {
    const response = await request(app)[method](path);
    assert.equal(response.status, 401, `${method.toUpperCase()} ${path}`);
  }
});

test('comment retry identity is scoped to the account and rejects changed payload', async () => {
  const req = { user: { id: 11 }, get: () => 'retry_key_12345' };
  const first = commentRequestIdentity(req, { postId: 3, content: 'hello' });
  const repeated = commentRequestIdentity(req, { postId: 3, content: 'hello' });
  assert.deepEqual(first, repeated);
  assert.notEqual(first.request_key, commentRequestIdentity({ ...req, user: { id: 12 } }, { postId: 3, content: 'hello' }).request_key);
  const collection = { findOne: async () => ({ id: 9, ...first }) };
  assert.equal((await existingCommentForRequest(collection, repeated)).id, 9);
  await assert.rejects(existingCommentForRequest(collection, commentRequestIdentity(req, { postId: 3, content: 'changed' })),
    (error) => error.status === 409);
});
