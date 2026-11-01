import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDiscussion } from '../../frontend/src/utils/streaming/discussionFeed.js';

test('movie comments and screenshot posts merge chronologically with stable pagination', () => {
  const comments = [{ id: 1, created_at: '2026-01-01T00:00:01Z' }, { id: 2, created_at: '2026-01-01T00:00:03Z' }];
  const posts = [{ id: 1, created_at: '2026-01-01T00:00:02Z' }, { id: 3, created_at: '2026-01-01T00:00:00Z' }];
  const first = mergeDiscussion(comments, posts, 1, 2);
  assert.deepEqual(first.items.map(({ type, item }) => [type, item.id]), [['comment', 2], ['post', 1]]);
  assert.equal(first.hasMore, true);
  const second = mergeDiscussion(comments, posts, 2, 2);
  assert.deepEqual(second.items.map(({ type, item }) => [type, item.id]), [['comment', 1], ['post', 3]]);
  assert.equal(second.hasMore, false);
});
