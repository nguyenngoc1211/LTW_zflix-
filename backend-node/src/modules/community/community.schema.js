// MongoDB definitions for new community collections. Existing ratings, comments,
// notifications and watch_history remain untouched until their migration phase.
const id = { bsonType: ['int', 'long', 'double'], minimum: 1 };
const date = { bsonType: 'date' };
const text = (maxLength) => ({ bsonType: 'string', minLength: 1, maxLength });
const enumeration = (...values) => ({ enum: values });
const schema = (required, properties) => ({ $jsonSchema: {
  bsonType: 'object', required: ['_id', ...required], properties,
} });
const indexes = (...items) => items.map(([key, options = {}]) => ({ key, ...options }));

export const communitySchemas = {
  community_posts: {
    validator: schema(['author_id', 'type', 'title', 'content', 'visibility', 'status', 'created_at', 'updated_at'], {
      author_id: id, type: enumeration('normal', 'screenshot'), title: text(200), content: { bsonType: 'string', maxLength: 10000 },
      production_id: id, episode_id: id, community_id: id, timestamp_seconds: { bsonType: ['int', 'long', 'double'], minimum: 0 },
      screenshot_key: text(1024), images: { bsonType: 'array', maxItems: 10, items: text(1024) },
      tags: { bsonType: 'array', maxItems: 20, items: text(50) }, is_spoiler: { bsonType: 'bool' },
      show_on_movie_page: { bsonType: 'bool' }, visibility: enumeration('public', 'members'), status: enumeration('active', 'hidden', 'deleted'),
      upvotes: { bsonType: ['int', 'long'], minimum: 0 }, downvotes: { bsonType: ['int', 'long'], minimum: 0 },
      score: { bsonType: ['int', 'long'] }, comment_count: { bsonType: ['int', 'long'], minimum: 0 }, created_at: date, updated_at: date,
    }),
    indexes: indexes([{ status: 1, visibility: 1, created_at: -1, _id: -1 }], [{ production_id: 1, episode_id: 1, status: 1, created_at: -1, _id: -1 }], [{ production_id: 1, status: 1, created_at: -1, _id: -1 }], [{ community_id: 1, status: 1, created_at: -1, _id: -1 }], [{ author_id: 1, created_at: -1 }]),
  },
  community_post_comments: {
    validator: schema(['post_id', 'author_id', 'content', 'status', 'created_at', 'updated_at'], { post_id: id, author_id: id, parent_id: id, content: text(3000), status: enumeration('active', 'hidden', 'deleted'), is_spoiler: { bsonType: 'bool' }, score: { bsonType: ['int', 'long'] }, created_at: date, updated_at: date }),
    indexes: indexes([{ post_id: 1, parent_id: 1, created_at: 1, _id: 1 }]),
  },
  community_post_votes: { validator: schema(['post_id', 'user_id', 'value'], { post_id: id, user_id: id, value: enumeration(-1, 1) }), indexes: indexes([{ post_id: 1, user_id: 1 }, { unique: true }]) },
  community_comment_votes: { validator: schema(['comment_id', 'user_id', 'value'], { comment_id: id, user_id: id, value: enumeration(-1, 1) }), indexes: indexes([{ comment_id: 1, user_id: 1 }, { unique: true }]) },
  community_groups: { validator: schema(['owner_id', 'slug', 'name', 'status', 'created_at'], { owner_id: id, slug: text(100), name: text(100), status: enumeration('active', 'hidden', 'deleted'), created_at: date }), indexes: indexes([{ slug: 1 }, { unique: true }]) },
  community_members: { validator: schema(['community_id', 'user_id', 'role', 'status', 'created_at'], { community_id: id, user_id: id, role: enumeration('owner', 'moderator', 'member'), status: enumeration('active', 'banned', 'left'), created_at: date }), indexes: indexes([{ community_id: 1, user_id: 1 }, { unique: true }], [{ user_id: 1, status: 1 }]) },
  community_follows: { validator: schema(['follower_id', 'followed_id', 'created_at'], { follower_id: id, followed_id: id, created_at: date }), indexes: indexes([{ follower_id: 1, followed_id: 1 }, { unique: true }], [{ followed_id: 1, created_at: -1 }]) },
  community_saved_posts: { validator: schema(['user_id', 'post_id', 'created_at'], { user_id: id, post_id: id, created_at: date }), indexes: indexes([{ user_id: 1, post_id: 1 }, { unique: true }], [{ user_id: 1, created_at: -1 }]) },
  community_reports: { validator: schema(['reporter_id', 'target_type', 'target_id', 'reason', 'status', 'created_at'], { reporter_id: id, target_type: enumeration('post', 'comment', 'user'), target_id: id, reason: text(2000), status: enumeration('open', 'resolved', 'dismissed'), created_at: date }), indexes: indexes([{ status: 1, created_at: 1 }], [{ target_type: 1, target_id: 1 }]) },
  community_watch_diary: { validator: schema(['user_id', 'production_id', 'watched_at', 'visibility', 'status'], { user_id: id, production_id: id, episode_id: id, watched_at: date, visibility: enumeration('private', 'public'), status: enumeration('active', 'deleted') }), indexes: indexes([{ user_id: 1, status: 1, watched_at: -1 }]) },
};

// Screenshot posts must describe the same single image and episode in every view.
communitySchemas.community_posts.validator.$jsonSchema.oneOf = [
  { properties: { type: { enum: ['normal'] } } },
  { properties: { type: { enum: ['screenshot'] }, images: { bsonType: 'array', minItems: 1, maxItems: 1 } },
    required: ['production_id', 'episode_id', 'timestamp_seconds', 'screenshot_key', 'images'] },
];

// Cross-document ownership, episode/production consistency, image-key equality,
// and counters must also be enforced by the write services.
