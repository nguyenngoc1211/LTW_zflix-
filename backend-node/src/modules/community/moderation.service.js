import { mongoCollection, nextNumericId, withMongoTransaction } from '../../core/database/mongo.js';
import { awardPoint, ensurePointIndexes, reversePoints } from './points.service.js';
import { createNotification, emitStoredNotification, ensureNotificationIndexes } from './notification.service.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const REASONS = ['spam', 'harassment', 'inappropriate', 'spoiler', 'fraud', 'other'];
const ACTIONS = ['dismiss', 'hide', 'delete', 'warn', 'lock'];

export async function submitModerationReport(reporterId, body) {
  const { targetType, targetId, commentSource, authorId, productionId, reason, description = '' } = body || {};
  if (!['post', 'comment', 'rating', 'user'].includes(targetType) || !Number.isSafeInteger(targetId) || targetId < 1 || !REASONS.includes(reason) || typeof description !== 'string' || description.length > 1000) throw fail('Invalid report');
  let target, owner, key, extra = {};
  if (targetType === 'post') {
    target = await (await mongoCollection('community_posts')).findOne({ _id: targetId, status: 'active', visibility: 'public' });
    owner = target?.author_id; key = `community-post:${targetId}:${reporterId}`;
  } else if (targetType === 'comment') {
    if (!['community', 'scene', 'movie'].includes(commentSource)) throw fail('Comment source is required');
    target = await (await mongoCollection(commentSource === 'movie' ? 'comments' : 'community_post_comments')).findOne({ _id: targetId, status: 'active' });
    if (target && commentSource !== 'movie' && !await (await mongoCollection('community_posts')).findOne({ _id: target.post_id, status: 'active', visibility: 'public' }, { projection: { _id: 1 } })) target = null;
    owner = target?.author_id ?? target?.user_id; key = `${commentSource}-comment:${targetId}:${reporterId}`;
    extra = { comment_source: commentSource, ...(target?.post_id && { post_id: target.post_id }) };
  } else if (targetType === 'rating') {
    if (!Number.isSafeInteger(authorId) || !Number.isSafeInteger(productionId) || productionId !== targetId) throw fail('Rating author and production are required');
    target = await (await mongoCollection('ratings')).findOne({ user_id: authorId, production_id: productionId, moderation_hidden: { $ne: true }, review_content: { $type: 'string', $ne: '' } });
    owner = target?.user_id; key = `rating:${authorId}:${productionId}:${reporterId}`;
    extra = { review_source: 'rating', review_author_id: authorId };
  } else {
    target = await (await mongoCollection('users')).findOne({ id: targetId, status: 'active' });
    owner = target?.id; key = `user:${targetId}:${reporterId}`;
  }
  if (!target || owner === reporterId) throw fail('Report target not found', 404);
  const excerpt = targetType === 'post' ? `${target.title || ''} ${target.content || ''}` : targetType === 'comment' ? target.content : targetType === 'rating' ? target.review_content : '';
  const report = { _id: key, reporter_id: reporterId, target_type: targetType === 'rating' ? 'post' : targetType, target_id: targetId, ...extra, ...(excerpt && { target_excerpt: excerpt.trim().slice(0, 500) }),
    reason, description: description.trim(), status: 'open', created_at: new Date(), report_numeric_id: await nextNumericId('community_reports') };
  try { await (await mongoCollection('community_reports')).insertOne(report); }
  catch (error) { if (error.code === 11000) throw fail('Already reported', 409); throw error; }
  return { id: key, status: 'open' };
}

async function moderateContent(report, action, session, now) {
  const targetId = report.target_id;
  if (report.review_source !== 'rating' && report.target_type === 'post') {
    const posts = await mongoCollection('community_posts');
    const post = await posts.findOne({ _id: targetId }, { session });
    if (!post) throw fail('Post not found', 404);
    if (post.status === 'active') {
      await posts.updateOne({ _id: targetId, status: 'active' }, { $set: { status: action === 'delete' ? 'deleted' : 'hidden', updated_at: now } }, { session });
      await reversePoints({ sourceType: 'post', sourceId: targetId, session });
      await reversePoints({ sourceType: 'post_vote', sourceId: targetId, session });
      await reversePoints({ sourceType: 'post_milestone', sourceId: targetId, session });
      for (const comment of await (await mongoCollection('community_post_comments')).find({ post_id: targetId }, { session, projection: { _id: 1 } }).toArray()) {
        await reversePoints({ sourceType: 'post_comment', sourceId: comment._id, session });
        await reversePoints({ sourceType: 'comment_vote', sourceId: comment._id, session });
      }
    }
    return { userId: post.author_id, targetStatus: action === 'delete' ? 'deleted' : 'hidden' };
  }
  if (report.target_type === 'comment') {
    const movie = report.comment_source === 'movie';
    const comments = await mongoCollection(movie ? 'comments' : 'community_post_comments');
    const comment = await comments.findOne({ _id: targetId }, { session });
    if (!comment) throw fail('Comment not found', 404);
    if (comment.status === 'active') {
      await comments.updateOne({ _id: targetId, status: 'active' }, { $set: { status: action === 'delete' ? 'deleted' : 'hidden', updated_at: now } }, { session });
      await reversePoints({ sourceType: movie ? 'movie_comment' : 'post_comment', sourceId: targetId, session });
      await reversePoints({ sourceType: movie ? 'movie_comment_vote' : 'comment_vote', sourceId: targetId, session });
    }
    return { userId: comment.author_id ?? comment.user_id, targetStatus: action === 'delete' ? 'deleted' : 'hidden' };
  }
  const ratings = await mongoCollection('ratings');
  const rating = await ratings.findOne({ user_id: report.review_author_id, production_id: targetId }, { session });
  if (!rating) throw fail('Review not found', 404);
  if (action === 'delete') await ratings.deleteOne({ user_id: report.review_author_id, production_id: targetId }, { session });
  else await ratings.updateOne({ user_id: report.review_author_id, production_id: targetId }, { $set: { moderation_hidden: true, updated_at: now } }, { session });
  const summary = await ratings.aggregate([{ $match: { production_id: targetId, moderation_hidden: { $ne: true } } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }], { session }).next();
  await (await mongoCollection('productions')).updateOne({ id: targetId }, { $set: { rating_count: summary?.count || 0, rating_avg: summary?.average || 0 } }, { session });
  return { userId: report.review_author_id, targetStatus: action === 'delete' ? 'deleted' : 'hidden' };
}

export async function resolveModerationReport(reportId, adminId, { action, reason, durationHours } = {}, actorRole = 'admin') {
  if (!ACTIONS.includes(action) || typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500 || (action === 'lock' && (!Number.isSafeInteger(durationHours) || durationHours < 1 || durationHours > 720))) throw fail('Action and reason are required');
  await ensurePointIndexes(); await ensureNotificationIndexes();
  const result = await withMongoTransaction(async (session) => {
    const reports = await mongoCollection('community_reports');
    const report = await reports.findOne({ _id: reportId, status: 'open' }, { session });
    if (!report) return null;
    if (actorRole === 'moderator' && report.target_type === 'user' && action !== 'dismiss') {
      const target = await (await mongoCollection('users')).findOne({ id: report.target_id }, { session, projection: { role: 1 } });
      if (target?.role !== 'user') throw fail('Moderator cannot moderate staff accounts', 403);
    }
    const now = new Date();
    let targetUserId = report.target_type === 'user' ? report.target_id : null;
    let targetStatus = null;
    if (action !== 'dismiss') {
      if (report.target_type === 'user') {
        if (['hide', 'delete'].includes(action)) throw fail('Invalid action for account');
      } else {
        const content = await moderateContent(report, action, session, now);
        targetUserId = content.userId; targetStatus = content.targetStatus;
      }
      if (!targetUserId || targetUserId === adminId) throw fail('Invalid target account', 409);
      const users = await mongoCollection('users');
      const targetUser = await users.findOne({ id: targetUserId, status: 'active' }, { session });
      if (!targetUser) throw fail('Target account not found', 404);
      if (action === 'lock') {
        if (targetUser.role !== 'user') throw fail('Staff account cannot be locked from reports', 403);
        const start = Math.max(now.getTime(), new Date(targetUser.moderation_locked_until || 0).getTime());
        await users.updateOne({ id: targetUserId, status: 'active' }, { $set: { moderation_locked_until: new Date(start + durationHours * 3600000) } }, { session });
      }
      await awardPoint({ userId: report.reporter_id, type: 'report', sourceType: 'report', sourceId: report.report_numeric_id || report.target_id, actorId: report.reporter_id, session });
    }
    const status = action === 'dismiss' ? 'dismissed' : 'resolved';
    await reports.updateOne({ _id: reportId, status: 'open' }, { $set: { status, action, review_reason: reason.trim(), reviewed_by: adminId, reviewed_at: now, ...(targetStatus && { target_status: targetStatus }), ...(action === 'lock' && { duration_hours: durationHours }) } }, { session });
    await (await mongoCollection('moderation_audit')).insertOne({ reportId, actorId: adminId, reporterId: report.reporter_id, targetType: report.target_type, reviewSource: report.review_source || null, targetId: report.target_id, targetUserId, action, reason: reason.trim(), durationHours: action === 'lock' ? durationHours : null, createdAt: now }, { session });
    const reporterNotification = await createNotification({ recipientId: report.reporter_id, type: 'system', title: 'Kết quả báo cáo', message: action === 'dismiss' ? 'Báo cáo của bạn đã được xem xét và từ chối.' : 'Báo cáo của bạn đã được xác nhận và xử lý.', entityType: 'moderation_report', entityId: report.target_id, redirectUrl: '/notifications', deduplicationKey: `report-result:${reportId}`, session });
    const targetNotification = action === 'dismiss' ? null : await createNotification({ recipientId: targetUserId, type: 'system', title: action === 'lock' ? 'Tài khoản tạm khóa' : action === 'warn' ? 'Cảnh cáo vi phạm' : 'Nội dung đã bị xử lý', message: action === 'lock' ? `Tài khoản bị khóa ${durationHours} giờ. Lý do: ${reason.trim()}` : `Lý do: ${reason.trim()}`, entityType: 'moderation_report', entityId: report.target_id, redirectUrl: '/notifications', deduplicationKey: `report-target:${reportId}`, session });
    return { status, action, notifications: [reporterNotification, targetNotification] };
  });
  result?.notifications.forEach(emitStoredNotification);
  return result && { status: result.status, action: result.action };
}
