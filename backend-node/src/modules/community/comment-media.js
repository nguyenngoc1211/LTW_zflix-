import multer from 'multer';
import { createHash } from 'node:crypto';
import { toPublicMediaUrl } from '../../core/storage/public-url.js';
import { uploadPostImages, cleanupPostImages } from './post-images.js';
import { mongoCollection } from '../../core/database/mongo.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 } });
export const commentImageUpload = (req, res, next) => upload.single('image')(req, res, (error) => error ? res.status(400).json({ message: 'Only one image up to 5 MB is allowed' }) : next());
export const commentImageHash = (file) => file ? createHash('sha256').update(file.buffer).digest('hex') : null;
export const commentImageUrls = (images = []) => images.map((key) => key.startsWith('local/community/posts/') ? `/uploads/${key.slice(6)}` : toPublicMediaUrl(key)).filter(Boolean);
export const saveCommentImage = async (file) => file ? uploadPostImages([file]) : [];
export const cleanupCommentImages = cleanupPostImages;
export const finalizeCommentImages = async (keys) => {
  if (!keys.length) return;
  try { await (await mongoCollection('community_upload_cleanup')).deleteMany({ _id: { $in: keys } }); }
  catch (error) { console.error('Comment image reconciliation pending', error.message); }
};
export const commentBool = (value) => value === true || value === 'true';
