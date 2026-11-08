import { randomUUID } from 'node:crypto';
import { mongoCollection } from '../../core/database/mongo.js';
import { createNotification } from './notification.service.js';
import { defaultNotificationPreferences } from './notification-preferences.js';

export const ensureEpisodeNotificationJobIndex = async () =>
  (await mongoCollection('notification_jobs')).createIndex({ type: 1, status: 1, created_at: 1 });

export const isPublishableEpisode = (episode) => Boolean(episode?.video_url && !['draft', 'hidden'].includes(episode.status));

// A batch is explicit. The final episode closes it; a failed partial upload
// remains awaiting_batch and can be resumed with the same batch ID.
export const queueEpisodeNotification = async ({ episodeId, productionId, batchId, batchComplete = false, session }) => {
  if (batchId && !/^[A-Za-z0-9_-]{8,80}$/.test(batchId)) throw new Error('Invalid publication batch ID');
  const id = batchId ? `episode-batch:${productionId}:${batchId}` : `episode:${episodeId}`;
  const existing = await (await mongoCollection('notification_jobs')).findOne({ _id: id }, { session });
  if (['running', 'done'].includes(existing?.status)) {
    if (existing.episode_ids?.includes(episodeId)) return;
    const error = new Error('Publication batch is already processing or complete'); error.status = 409; throw error;
  }
  if (batchId && existing?.status === 'pending' && !existing.episode_ids?.includes(episodeId)) {
    const error = new Error('Publication batch is already closed'); error.status = 409; throw error;
  }
  await (await mongoCollection('notification_jobs')).updateOne(
    { _id: id, status: { $nin: ['running', 'done'] } },
    { $addToSet: { episode_ids: episodeId },
      ...(batchComplete && { $set: { status: 'pending' } }),
      $setOnInsert: { type: 'new_episode', episode_id: episodeId, production_id: productionId,
        ...(!batchComplete && { status: batchId ? 'awaiting_batch' : 'pending' }), created_at: new Date() } },
    { upsert: true, ...(session && { session }) });
};

export const processEpisodeNotificationJobs = async () => {
  const jobs = await mongoCollection('notification_jobs');
  const now = new Date();
  const claimToken = randomUUID();
  const job = await jobs.findOneAndUpdate(
    { type: 'new_episode', $or: [
      { status: 'pending', $or: [{ next_retry_at: { $exists: false } }, { next_retry_at: { $lte: now } }] },
      { status: 'running', lease_until: { $lt: now } },
    ] },
    { $set: { status: 'running', claim_token: claimToken, lease_until: new Date(now.getTime() + 120000) }, $inc: { attempts: 1 } },
    { sort: { created_at: 1 }, returnDocument: 'after' });
  if (!job) return;
  const owned = { _id: job._id, status: 'running', claim_token: claimToken };
  const heartbeat = setInterval(() => jobs.updateOne(owned,
    { $set: { lease_until: new Date(Date.now() + 120000) } }).catch(() => {}), 30000);
  heartbeat.unref();
  try {
    const ids = job.episode_ids || [job.episode_id];
    const [episodes, production] = await Promise.all([
      (await mongoCollection('episodes')).find({ id: { $in: ids }, production_id: job.production_id }).toArray(),
      (await mongoCollection('productions')).findOne({ id: job.production_id }),
    ]);
    const published = episodes.filter(isPublishableEpisode).sort((a, b) => Number(a.episode_number) - Number(b.episode_number));
    if (!published.length || !production) {
      await jobs.updateOne(owned, { $set: { status: 'done', completed_at: new Date() }, $unset: { claim_token: '', lease_until: '' } });
      return;
    }
    const newest = published[published.length - 1];
    const prior = await (await mongoCollection('episodes')).find({ production_id: job.production_id,
      id: { $nin: ids } }, { projection: { id: 1 } }).toArray();
    const priorIds = prior.map((item) => item.id);
    const recipients = (await mongoCollection('watch_history')).aggregate([
      { $match: { episode_id: { $in: priorIds } } }, { $project: { user_id: 1 } },
      { $unionWith: { coll: 'bookmarks', pipeline: [{ $match: { production_id: job.production_id } }, { $project: { user_id: 1 } }] } },
      { $unionWith: { coll: 'production_interests', pipeline: [{ $match: { production_id: job.production_id } }, { $project: { user_id: 1 } }] } },
      { $group: { _id: '$user_id' } },
    ], { allowDiskUse: true });
    const deliver = async (userIds) => {
      const users = await (await mongoCollection('users')).find({ id: { $in: userIds }, status: 'active' },
        { projection: { id: 1, notification_preferences: 1 } }).toArray();
      for (const user of users) {
        const preferences = { ...defaultNotificationPreferences, ...user.notification_preferences };
        if (!preferences.episode_updates) continue;
        await createNotification({ recipientId: user.id, type: 'new_episode', title: 'Có tập mới!',
          message: published.length === 1 ? `${production.title} đã có tập ${newest.episode_number}`
            : `${production.title} vừa cập nhật ${published.length} tập mới (Tập ${published[0].episode_number}–${newest.episode_number}).`,
          entityType: 'episode', entityId: newest.id, redirectUrl: `/watch-episode/${newest.id}`,
          metadata: { productionId: job.production_id, posterUrl: production.poster_url || null,
            episodeCount: published.length, firstEpisodeNumber: published[0].episode_number,
            lastEpisodeNumber: newest.episode_number, episodeIds: published.map((item) => item.id) },
          deduplicationKey: `${job._id}:recipient:${user.id}`, preferences });
      }
    };
    let batch = [];
    for await (const entry of recipients) {
      if (!Number.isSafeInteger(entry._id) || entry._id <= 0) continue;
      batch.push(entry._id);
      if (batch.length >= 200) { await deliver(batch); batch = []; }
    }
    if (batch.length) await deliver(batch);
    await jobs.updateOne(owned, { $set: { status: 'done', completed_at: new Date() }, $unset: { claim_token: '', lease_until: '' } });
  } catch (error) {
    const delay = Math.min(3600000, 5000 * 2 ** Math.min(job.attempts || 1, 10));
    await jobs.updateOne(owned, { $set: { status: 'pending', next_retry_at: new Date(Date.now() + delay),
      last_error: String(error.message).slice(0, 500) }, $unset: { claim_token: '', lease_until: '' } });
    throw error;
  } finally { clearInterval(heartbeat); }
};
