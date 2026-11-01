import 'dotenv/config';
import { MongoClient } from 'mongodb';

const name = process.env.MONGODB_DB_NAME;
if (!name || !process.env.MONGODB_URI || name === process.env.COMMUNITY_TEST_DB_NAME) throw new Error('Main database configuration required');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try {
  await client.connect();
  const db = client.db(name);
  for (const collection of ['community_posts', 'community_post_votes', 'community_post_comments', 'community_comment_votes', 'community_saved_posts']) {
    console.log(collection, await db.collection(collection).countDocuments());
  }
  for (const [collection, fields] of [['community_post_votes', ['post_id', 'user_id']], ['community_comment_votes', ['comment_id', 'user_id']], ['community_saved_posts', ['post_id', 'user_id']]]) {
    const groups = await db.collection(collection).aggregate([
      { $group: { _id: Object.fromEntries(fields.map((field) => [field, `$${field}`])), count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $limit: 1 },
    ]).toArray();
    console.log(`${collection} duplicate identity pairs:`, groups.length > 0);
  }
} finally { await client.close(); }
