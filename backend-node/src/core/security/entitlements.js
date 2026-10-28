const STAFF_ROLES = new Set(["admin", "moderator"]);

export const isVipActive = (vipExpiresAt, now = Date.now()) => {
  if (!vipExpiresAt) return false;
  const expiresAt = new Date(vipExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
};

export const canAccessPremium = (user, now = Date.now()) =>
  Boolean(user && (STAFF_ROLES.has(user.role) || isVipActive(user.vipExpiresAt, now)));
