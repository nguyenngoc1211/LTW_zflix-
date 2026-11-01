import 'dotenv/config';
import { mongoCollection, closeMongo } from '../src/core/database/mongo.js';
import { cleanupPostImages } from '../src/modules/community/post-images.js';

// Writers must be stopped for --apply. The age threshold alone cannot prove
// that an exceptionally slow or interrupted request is no longer committing.
const apply = process.argv.includes('--apply');
if (apply && process.env.COMMUNITY_UPLOAD_WRITERS_STOPPED !== 'yes') throw new Error('Stop all community upload writers and set COMMUNITY_UPLOAD_WRITERS_STOPPED=yes before --apply');
if (apply && (!process.env.R2_BUCKET_NAME || !process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY)) throw new Error('R2 configuration is required');
try {
  const pending = await mongoCollection('community_upload_cleanup');
  const posts = await mongoCollection('community_posts');
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cursor = pending.find({ status: 'pending', created_at: { $lt: cutoff } }).sort({ created_at: 1 }).limit(500);
  for await (const item of cursor) {
    const key = item._id;
    if (typeof key !== 'string' || !/^(local\/)?community\/posts\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) {
      console.error('Skipping unexpected key');
      continue;
    }
    const referenced = await posts.findOne({ $or: [{ images: key }, { screenshot_key: key }] }, { projection: { _id: 1 } });
    console.log(`${referenced ? 'referenced' : 'unreferenced'} ${key}`);
    if (!apply) continue;
    if (referenced) await pending.deleteOne({ _id: key, status: 'pending' });
    else await cleanupPostImages([key]);
  }
} finally {
  await closeMongo();
}
