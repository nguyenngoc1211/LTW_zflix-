import 'dotenv/config';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const name = process.env.COMMUNITY_TEST_DB_NAME || '';
if (!process.env.COMMUNITY_TEST_MONGODB_URI?.trim() || name !== 'community_test_schema_20261101' || !name.startsWith('community_test') || name === 'zflix' || name === process.env.MONGODB_DB_NAME) throw new Error('The dedicated community test database is required');
process.env.MONGODB_URI = process.env.COMMUNITY_TEST_MONGODB_URI;
process.env.MONGODB_DB_NAME = name;
for (const key of ['R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) process.env[key] = 'community-test-only';
const { default: s3 } = await import('../src/core/storage/r2.js');
const { uploadPostImages, cleanupPostImages } = await import('../src/modules/community/post-images.js');
const { closeMongo } = await import('../src/core/database/mongo.js');
const client = new MongoClient(process.env.MONGODB_URI);
const originalSend = s3.send;
const touched = [];
try {
  await client.connect();
  const pending = client.db(name).collection('community_upload_cleanup');
  const png = { mimetype: 'image/png', buffer: await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer() };
  let failDelete = false;
  s3.send = async (command) => {
    touched.push(command.input.Key);
    if (command instanceof PutObjectCommand) throw new Error('simulated upload failure');
    if (command instanceof DeleteObjectCommand && failDelete) throw new Error('simulated delete failure');
    return {};
  };
  await assert.rejects(uploadPostImages([{ mimetype: 'image/png', buffer: Buffer.from('invalid') }]), /valid PNG/);
  await assert.rejects(uploadPostImages([{ mimetype: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) }]), /Invalid or unsupported image/);
  await assert.rejects(uploadPostImages([png]), /simulated upload failure/);
  assert.equal(await pending.countDocuments({ _id: { $in: touched } }), 0);
  failDelete = true;
  await assert.rejects(uploadPostImages([png]), /simulated upload failure/);
  assert.equal(await pending.countDocuments({ _id: { $in: touched } }), 1);
  failDelete = false;
  await cleanupPostImages([...new Set(touched)]);
  assert.equal(await pending.countDocuments({ _id: { $in: touched } }), 0);
  console.log('Simulated upload and cleanup failures retain and clear cleanup intent');
} finally {
  s3.send = originalSend;
  if (client.topology?.isConnected() && touched.length) await client.db(name).collection('community_upload_cleanup').deleteMany({ _id: { $in: touched } });
  await closeMongo();
  await client.close();
}
