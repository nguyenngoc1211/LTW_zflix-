import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { communitySchemas } from '../src/modules/community/community.schema.js';

// This setup only creates missing collections and indexes. It never deletes
// documents or changes validators on existing collections.
const name = process.env.MONGODB_DB_NAME;
if (name !== 'Zflix' || !process.env.MONGODB_URI?.trim() || name === process.env.COMMUNITY_TEST_DB_NAME) throw new Error('Expected the configured Zflix database');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
const targets = ['community_posts', 'community_post_comments', 'community_post_votes', 'community_comment_votes', 'community_saved_posts'];
try {
  await client.connect();
  const db = client.db(name);
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  // Preflight uniqueness before any write to the configured database.
  for (const [collection, fields] of [['community_post_votes', ['post_id', 'user_id']], ['community_comment_votes', ['comment_id', 'user_id']], ['community_saved_posts', ['user_id', 'post_id']]]) {
    if (!names.has(collection)) continue;
    const duplicates = await db.collection(collection).aggregate([
      { $group: { _id: Object.fromEntries(fields.map((field) => [field, `$${field}`])), count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $limit: 1 },
    ]).toArray();
    if (duplicates.length) throw new Error(`Duplicate identity pairs in ${collection}; no changes applied`);
  }
  for (const collection of targets) {
    const definition = communitySchemas[collection];
    if (!names.has(collection)) {
      await db.createCollection(collection, { validator: definition.validator, validationLevel: 'strict', validationAction: 'error' });
      console.log(`Created ${collection}`);
    }
    await db.collection(collection).createIndexes(definition.indexes);
    console.log(`Indexes ready: ${collection}`);
  }
} finally { await client.close(); }
