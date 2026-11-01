import test from 'node:test';
import assert from 'node:assert/strict';
import { imageType } from '../src/modules/community/post-images.js';

test('image signatures identify supported formats and reject arbitrary bytes', () => {
  assert.deepEqual(imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), ['image/png', 'png']);
  assert.deepEqual(imageType(Buffer.from([255, 216, 255])), ['image/jpeg', 'jpg']);
  assert.deepEqual(imageType(Buffer.from('RIFF0000WEBP')), ['image/webp', 'webp']);
  assert.equal(imageType(Buffer.from('<svg>')), null);
});
