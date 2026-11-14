export const notificationIcon = (type) => ({
  new_episode: '🎬', comment_reply: '💬', post_comment: '💬', mention: '@',
  like: '♥', vip_reminder: '★', vip_expired: '★', vip: '★', security: '🔒',
})[type] || '🔔';
