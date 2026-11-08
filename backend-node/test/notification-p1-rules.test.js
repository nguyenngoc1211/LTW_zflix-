import test from 'node:test';
import assert from 'node:assert/strict';
import { mentionNames } from '../src/modules/community/mention.service.js';
import { defaultNotificationPreferences, notificationPreferenceKey, validateNotificationPreferences } from '../src/modules/community/notification-preferences.js';

test('mentions are bounded, distinct and require a username token', () => {
  assert.deepEqual(mentionNames('Hi @alice_1, @bob_2 and @alice_1. <script>@charlie_3</script>'),
    ['alice_1', 'bob_2', 'charlie_3']);
  assert.deepEqual(mentionNames('email@example.com @ab @valid_user'), ['valid_user']);
  assert.equal(mentionNames(Array.from({ length: 30 }, (_, i) => `@user_${i}`).join(' ')).length, 20);
});

test('preference writes accept only boolean interaction keys', () => {
  assert.equal(Object.keys(defaultNotificationPreferences).length, 6);
  assert.deepEqual(validateNotificationPreferences({ likes: false, vip_reminders: true }), { likes: false, vip_reminders: true });
  assert.equal(validateNotificationPreferences({ security: false }), null);
  assert.equal(validateNotificationPreferences({ likes: 'false' }), null);
  assert.equal(notificationPreferenceKey('security'), null);
  assert.equal(notificationPreferenceKey('vip_expired'), null);
});
