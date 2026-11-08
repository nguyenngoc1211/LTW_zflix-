const formatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

export const notificationTime = (value) => {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed)) return '';
  if (elapsed < 60000) return formatter.format(0, 'minute');
  if (elapsed < 3600000) return formatter.format(-Math.floor(elapsed / 60000), 'minute');
  if (elapsed < 86400000) return formatter.format(-Math.floor(elapsed / 3600000), 'hour');
  if (elapsed < 604800000) return formatter.format(-Math.floor(elapsed / 86400000), 'day');
  return new Date(value).toLocaleDateString('vi-VN');
};
