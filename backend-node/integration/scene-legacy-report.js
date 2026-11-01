import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const name = process.env.MONGODB_DB_NAME;
if (!uri?.trim() || !name?.trim()) throw new Error('Explicit application database configuration is required');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const db = client.db(name);
  if (db.databaseName !== name) throw new Error('Database name mismatch');
  const posts = db.collection('community_posts');
  const legacy = { content_type: { $exists: false } };
  const [total, normal, screenshot, linkedCommunity, unlinkedScreenshot, malformed, unknown] = await Promise.all([
    posts.countDocuments(legacy),
    posts.countDocuments({ ...legacy, type: 'normal' }),
    posts.countDocuments({ ...legacy, type: 'screenshot' }),
    posts.countDocuments({ ...legacy, type: 'screenshot', community_id: { $exists: true } }),
    posts.countDocuments({ ...legacy, type: 'screenshot', community_id: { $exists: false } }),
    posts.countDocuments({ ...legacy, type: 'screenshot', $or: [{ production_id: { $exists: false } }, { episode_id: { $exists: false } }, { timestamp_seconds: { $exists: false } }, { screenshot_key: { $exists: false } }] }),
    posts.countDocuments({ ...legacy, type: { $nin: ['normal', 'screenshot'] } }),
  ]);
  console.log(JSON.stringify({ database: db.databaseName, legacyTotal: total, legacyNormal: normal, legacyScreenshot: screenshot, screenshotWithCommunity: linkedCommunity, screenshotWithoutCommunity: unlinkedScreenshot, screenshotMissingMetadata: malformed, unknownType: unknown }, null, 2));
} catch {
  console.error('Read-only report failed; check the configured database connection.');
  process.exitCode = 1;
} finally { await client.close(); }
