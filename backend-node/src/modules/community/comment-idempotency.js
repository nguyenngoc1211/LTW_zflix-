import { createHash } from 'node:crypto';

const indexPromises = new Map();

export const commentRequestIdentity = (req, payload) => {
  const raw = req.get('Idempotency-Key');
  if (raw === undefined) return null;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(raw)) {
    const error = new Error('Invalid Idempotency-Key');
    error.status = 400;
    throw error;
  }
  return {
    request_key: `${req.user.id}:${raw}`,
    request_fingerprint: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
  };
};

export const ensureCommentRequestIndex = async (collection, name) => {
  if (!indexPromises.has(name)) {
    indexPromises.set(name, collection.createIndex({ request_key: 1 }, {
      unique: true, partialFilterExpression: { request_key: { $type: 'string' } },
    }).catch((error) => { indexPromises.delete(name); throw error; }));
  }
  await indexPromises.get(name);
};

export const existingCommentForRequest = async (collection, identity) => {
  if (!identity) return null;
  const existing = await collection.findOne({ request_key: identity.request_key });
  if (!existing) return null;
  if (existing.request_fingerprint !== identity.request_fingerprint) {
    const error = new Error('Idempotency-Key was used with different comment data');
    error.status = 409;
    throw error;
  }
  return existing;
};
