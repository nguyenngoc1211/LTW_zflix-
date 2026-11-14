import test from 'node:test';
import assert from 'node:assert/strict';
import { hasActiveVip, vipAvatarClass } from '../src/components/vipIdentity.js';

test('badge and avatar styling only apply to active VIP dates', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const expired = new Date(Date.now() - 86400000).toISOString();
  assert.equal(hasActiveVip(null), false);
  assert.equal(hasActiveVip(future), true);
  assert.equal(hasActiveVip(expired), false);
  assert.equal(vipAvatarClass(future), 'vip-member-avatar');
  assert.equal(vipAvatarClass(expired), '');
});
