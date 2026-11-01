import test from 'node:test';
import assert from 'node:assert/strict';
import { communitySchemas } from '../src/modules/community/community.schema.js';

test('community vote and membership identities have unique compound indexes', () => {
  for (const [name, fields] of Object.entries({ community_post_votes: ['post_id', 'user_id'], community_comment_votes: ['comment_id', 'user_id'], community_members: ['community_id', 'user_id'], community_saved_posts: ['user_id', 'post_id'], community_follows: ['follower_id', 'followed_id'] })) {
    assert.ok(communitySchemas[name].indexes.some((index) => index.unique && fields.every((field) => index.key[field] === 1)));
  }
});

test('schemas require their core identity and retain a separate post collection', () => {
  assert.ok(communitySchemas.community_posts.validator.$jsonSchema.required.includes('author_id'));
  assert.ok(communitySchemas.community_post_comments.validator.$jsonSchema.required.includes('post_id'));
  assert.equal(communitySchemas.comments, undefined);
  assert.equal(communitySchemas.ratings, undefined);
});

test('screenshot schema requires its movie, episode, timestamp and one image', () => {
  const postSchema = communitySchemas.community_posts.validator.$jsonSchema;
  const screenshot = postSchema.oneOf.find((branch) => branch.properties.type.enum.includes('screenshot'));
  for (const field of ['production_id', 'episode_id', 'timestamp_seconds', 'screenshot_key', 'images']) {
    assert.ok(screenshot.required.includes(field));
  }
  assert.equal(screenshot.properties.images.minItems, 1);
  assert.equal(screenshot.properties.images.maxItems, 1);
  assert.ok(communitySchemas.community_posts.indexes.some(({ key }) => key.production_id === 1 && key.status === 1 && !('episode_id' in key)));
});
