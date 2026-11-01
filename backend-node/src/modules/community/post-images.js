import { randomUUID } from 'node:crypto';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import s3 from '../../core/storage/r2.js';
import { mongoCollection } from '../../core/database/mongo.js';
import sharp from 'sharp';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const localDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/community/posts');
const localPattern = /^local\/community\/posts\/[0-9a-f-]{36}\.(png|jpg|webp)$/;

export function imageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['image/png', 'png'];
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return ['image/jpeg', 'jpg'];
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return ['image/webp', 'webp'];
  return null;
}

// Persist cleanup intent before any network request; even a timed-out PUT may
// have succeeded remotely. Keys are random and never supplied by the caller.
export async function uploadPostImages(files) {
  const bucket = process.env.R2_BUCKET_NAME;
  const r2Ready = [bucket, process.env.R2_PUBLIC_DOMAIN, process.env.R2_ACCOUNT_ID, process.env.R2_ACCESS_KEY_ID, process.env.R2_SECRET_ACCESS_KEY].every((value) => value?.trim() && value !== 'dev-placeholder');
  const local = !r2Ready && process.env.NODE_ENV === 'development';
  if (!r2Ready && !local) throw Object.assign(new Error('Image storage is unavailable'), { status: 503 });
  const images = await Promise.all(files.map(async (file) => {
    const kind = imageType(file.buffer);
    if (!kind || file.mimetype !== kind[0]) throw Object.assign(new Error('Only valid PNG, JPEG and WebP images are accepted'), { status: 400 });
    try {
      const pipeline = sharp(file.buffer, { failOn: 'error', limitInputPixels: 16000000, animated: false });
      const metadata = await pipeline.metadata();
      if (!metadata.width || !metadata.height || metadata.pages > 1 || metadata.format !== (kind[1] === 'jpg' ? 'jpeg' : kind[1])) throw new Error('Unsupported image');
      const buffer = await pipeline.rotate().toFormat(metadata.format).toBuffer();
      return { key: `${local ? 'local/' : ''}community/posts/${randomUUID()}.${kind[1]}`, buffer, mime: kind[0] };
    } catch { throw Object.assign(new Error('Invalid or unsupported image'), { status: 400 }); }
  }));
  const pending = await mongoCollection('community_upload_cleanup');
  const keys = images.map((image) => image.key);
  await pending.insertMany(keys.map((key) => ({ _id: key, created_at: new Date(), status: 'pending' })));
  try {
    if (local) await mkdir(localDir, { recursive: true });
    for (const image of images) {
      if (local) await writeFile(path.join(localDir, path.basename(image.key)), image.buffer, { flag: 'wx' });
      else await s3.send(new PutObjectCommand({ Bucket: bucket, Key: image.key, Body: image.buffer, ContentType: image.mime }));
    }
    return keys;
  } catch (error) {
    await cleanupPostImages(keys);
    throw error;
  }
}

export async function cleanupPostImages(keys) {
  const pending = await mongoCollection('community_upload_cleanup');
  for (const key of keys) {
    try {
      if (localPattern.test(key)) {
        try { await unlink(path.join(localDir, path.basename(key))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      } else {
        if (!/^community\/posts\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) throw new Error('Unexpected image key');
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
      }
      await pending.deleteOne({ _id: key });
    } catch (error) {
      console.error('Community image cleanup failed; pending record retained', key, error.message);
    }
  }
}
