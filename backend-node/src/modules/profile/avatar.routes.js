import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../core/middleware/auth.middleware.js';
import { requireFrontendOrigin } from '../../core/middleware/origin.middleware.js';
import { mongoCollection } from '../../core/database/mongo.js';
import s3 from '../../core/storage/r2.js';
import { toPublicMediaUrl } from '../../core/storage/public-url.js';
import { imageType } from '../community/post-images.js';
import { asyncHandler } from '../../core/utils/http.js';

export const avatarRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: 'draft-7', legacyHeaders: false });

avatarRouter.put('/avatar', requireAuth, requireFrontendOrigin, limiter, (req, res, next) => {
  upload.single('avatar')(req, res, (error) => error ? res.status(400).json({ message: 'Ảnh không hợp lệ hoặc vượt quá 5 MB.' }) : next());
}, asyncHandler(async (req, res) => {
  if (process.env.DATA_STORE !== 'mongodb') return res.status(503).json({ message: 'Cần cấu hình MongoDB.' });
  const config = ['R2_BUCKET_NAME', 'R2_PUBLIC_DOMAIN', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  if (!config.every((key) => process.env[key]?.trim() && process.env[key] !== 'dev-placeholder')) return res.status(503).json({ message: 'R2 chưa được cấu hình đầy đủ.' });
  const kind = req.file && imageType(req.file.buffer);
  if (!kind || req.file.mimetype !== kind[0]) return res.status(400).json({ message: 'Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP hợp lệ.' });
  let body;
  try {
    const input = sharp(req.file.buffer, { failOn: 'error', limitInputPixels: 16000000, animated: false });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height || metadata.pages > 1 || metadata.format !== (kind[1] === 'jpg' ? 'jpeg' : kind[1])) throw new Error('Invalid image');
    body = await input.rotate().resize(512, 512, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { return res.status(400).json({ message: 'Không đọc được ảnh hợp lệ.' }); }
  const key = `avatars/${req.user.id}/${randomUUID()}.webp`;
  const url = toPublicMediaUrl(key);
  const users = await mongoCollection('users');
  try {
    await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: 'image/webp' }));
    const result = await users.updateOne({ id: req.user.id, status: 'active' }, { $set: { avatar_url: url, updated_at: new Date() } });
    if (!result.matchedCount) throw Object.assign(new Error('Không tìm thấy tài khoản.'), { status: 404 });
  } catch (error) {
    // A write can succeed even if acknowledgement fails; delete only when a
    // fresh database read confirms that no user currently references the key.
    try {
      if (!await users.findOne({ avatar_url: url })) await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    } catch (cleanupError) { console.error('Avatar cleanup failed:', cleanupError.message); }
    throw error;
  }
  res.json({ avatarUrl: url });
}));
