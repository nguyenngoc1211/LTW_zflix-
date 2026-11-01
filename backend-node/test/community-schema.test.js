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
