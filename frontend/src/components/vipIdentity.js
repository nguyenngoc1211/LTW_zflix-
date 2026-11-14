export const hasActiveVip = (vipExpiresAt) => {
  const expires = new Date(vipExpiresAt).getTime();
  return Boolean(vipExpiresAt) && Number.isFinite(expires) && expires > Date.now();
};

export const vipAvatarClass = (vipExpiresAt) => hasActiveVip(vipExpiresAt) ? 'vip-member-avatar' : '';
