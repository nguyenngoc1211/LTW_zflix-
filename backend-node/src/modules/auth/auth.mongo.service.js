import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { securityConfig } from "../../config/security.config.js";
import { mongoCollection, nextNumericId, withMongoTransaction } from "../../core/database/mongo.js";
import { securityLog } from "../../core/security/security-logger.js";
import { isVipActive } from "../../core/security/entitlements.js";
import { createNotification, emitStoredNotification, ensureNotificationIndexes } from '../community/notification.service.js';
import { deliverPasswordReset, passwordResetDeliveryAvailable } from "./password-reset-delivery.js";
import {
  createMfaChallengeToken, createRecoveryCodes, createTotpEnrollment,
  decryptTotpSecret, encryptTotpSecret, hashOpaqueToken, hashRecoveryCode, validateTotp,
} from "./mfa.js";

export const REFRESH_COOKIE = "refreshToken";
const bcryptCost = 12;
const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || "15m";
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const newRefreshToken = () => crypto.randomBytes(48).toString("base64url");
const newPasswordResetToken = () => crypto.randomBytes(32).toString("base64url");
const future = (amount, unit) => new Date(Date.now() + amount * unit);
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const publicUser = (user) => ({
  id: user.id, username: user.username, email: user.email,
  avatarUrl: user.avatar_url, role: user.role,
  vipExpiresAt: user.vip_expires_at || null,
  isVip: isVipActive(user.vip_expires_at),
});
const signAccessToken = (user, sessionId) => jwt.sign(
  { role: user.role, sid: sessionId }, securityConfig.jwtAccessSecret,
  { subject: String(user.id), expiresIn: accessTokenTtl, algorithm: "HS256" },
);
const collections = async () => ({
  users: await mongoCollection("users"),
  sessions: await mongoCollection("auth_sessions"),
  challenges: await mongoCollection("auth_mfa_challenges"),
  recovery: await mongoCollection("auth_mfa_recovery_codes"),
  resets: await mongoCollection("password_reset_tokens"),
});

let indexPromise;
const ensureAuthIndexes = async () => {
  if (!indexPromise) {
    indexPromise = (async () => {
      const { users, sessions, challenges, recovery, resets } = await collections();
      await Promise.all([
        users.createIndex({ email: 1 }, { unique: true }),
        users.createIndex({ username: 1 }, { unique: true }),
        sessions.createIndex({ refresh_token_hash: 1 }, { unique: true }),
        sessions.createIndex({ user_id: 1, revoked_at: 1 }),
        challenges.createIndex({ token_hash: 1 }, { unique: true }),
        recovery.createIndex({ code_hash: 1 }, { unique: true }),
        resets.createIndex({ token_hash: 1 }, { unique: true }),
      ]);
    })().catch((error) => { indexPromise = undefined; throw error; });
  }
  return indexPromise;
};

export const refreshCookieOptions = () => ({
  httpOnly: true, secure: securityConfig.isProduction, sameSite: "lax",
  path: "/api/v1/auth", maxAge: securityConfig.refreshSession.idleTtlDays * DAY,
});
export const clearRefreshCookieOptions = () => {
  const { maxAge, ...options } = refreshCookieOptions();
  return options;
};

const createSession = async (user, metadata = {}, session) => {
  const { sessions } = await collections();
  const id = crypto.randomUUID();
  const refreshToken = newRefreshToken();
  const now = new Date();
  await sessions.insertOne({
    _id: id, id, user_id: user.id, refresh_token_hash: hashToken(refreshToken),
    user_agent: metadata.userAgent?.slice(0, 255) || null,
    ip_address: metadata.ipAddress?.slice(0, 45) || null,
    expires_at: future(securityConfig.refreshSession.idleTtlDays, DAY),
    absolute_expires_at: future(securityConfig.refreshSession.absoluteTtlDays, DAY),
    last_used_at: null, revoked_at: null, created_at: now,
  }, session ? { session } : undefined);
  return { sessionId: id, accessToken: signAccessToken(user, id), refreshToken, user: publicUser(user) };
};

export const registerLocalAccount = async ({ username, email, password }) => {
  await ensureAuthIndexes();
  const users = await mongoCollection("users");
  const id = await nextNumericId("users");
  await users.insertOne({
    _id: id, id, username, email, password: await bcrypt.hash(password, bcryptCost),
    avatar_url: "/default-avatar.png", role: "user", provider: "local", provider_id: null,
    status: "active", disabled_at: null, vip_expires_at: null, auto_renew: 0,
    total_watch_time: 0, failed_login_attempts: 0, locked_until: null,
    mfa_enabled: 0, mfa_secret_ciphertext: null, mfa_secret_iv: null,
    mfa_secret_tag: null, mfa_enabled_at: null, mfa_last_used_step: null,
    password_changed_at: null, last_login: null, created_at: new Date(), updated_at: new Date(),
  });
  return id;
};

export const login = async (email, password, metadata = {}) => {
  await ensureAuthIndexes();
  const { users, challenges } = await collections();
  const user = await users.findOne({ email });
  if (!user || user.provider !== "local" || !user.password) return null;
  if (user.status !== "active") return { denied: "disabled", userId: user.id };
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return { denied: "locked", userId: user.id };
  }
  if (!(await bcrypt.compare(password, user.password))) {
    const updated = await users.findOneAndUpdate({ id: user.id, status: "active" }, [
      { $set: { failed_login_attempts: { $cond: [
        { $and: [{ $ne: ["$locked_until", null] }, { $lte: ["$locked_until", new Date()] }] },
        1, { $add: [{ $ifNull: ["$failed_login_attempts", 0] }, 1] },
      ] } } },
      { $set: { locked_until: { $cond: [
        { $gte: ["$failed_login_attempts", securityConfig.accountLock.maxFailedAttempts] },
        future(securityConfig.accountLock.minutes, MINUTE), null,
      ] } } },
    ], { returnDocument: "after" });
    return { denied: updated?.locked_until ? "locked" : "invalid", userId: user.id };
  }
  await users.updateOne({ id: user.id }, { $set: { failed_login_attempts: 0, locked_until: null } });
  if (user.mfa_enabled) {
    const challengeToken = createMfaChallengeToken();
    await challenges.updateMany({ user_id: user.id, used_at: null }, { $set: { used_at: new Date() } });
    const id = await nextNumericId("auth_mfa_challenges");
    await challenges.insertOne({
      _id: id, id, user_id: user.id, token_hash: hashOpaqueToken(challengeToken),
      attempts: 0, max_attempts: securityConfig.mfa.challengeMaxAttempts,
      expires_at: future(securityConfig.mfa.challengeTtlSeconds, 1000),
      used_at: null, created_at: new Date(),
    });
    return { mfaRequired: true, userId: user.id, challengeToken,
      expiresInSeconds: securityConfig.mfa.challengeTtlSeconds };
  }
  await users.updateOne({ id: user.id }, { $set: { last_login: new Date() } });
  return createSession(user, metadata);
};

export const refresh = async (currentToken) => {
  const { sessions, users } = await collections();
  const currentHash = hashToken(currentToken);
  const existing = await sessions.findOne({ refresh_token_hash: currentHash, revoked_at: null });
  if (!existing) return null;
  const user = await users.findOne({ id: existing.user_id });
  const now = new Date();
  if (!user || user.status !== "active" || !existing.absolute_expires_at || existing.absolute_expires_at <= now) {
    await sessions.updateOne({ id: existing.id, revoked_at: null }, { $set: { revoked_at: now } });
    return null;
  }
  if (existing.expires_at <= now) return null;
  const nextToken = newRefreshToken();
  const result = await sessions.updateOne({
    id: existing.id, refresh_token_hash: currentHash, revoked_at: null,
    expires_at: { $gt: now }, absolute_expires_at: { $gt: now },
  }, { $set: {
    refresh_token_hash: hashToken(nextToken),
    expires_at: new Date(Math.min(future(securityConfig.refreshSession.idleTtlDays, DAY).getTime(), existing.absolute_expires_at.getTime())),
    last_used_at: now,
  } });
  if (result.modifiedCount !== 1) return null;
  return { sessionId: existing.id, accessToken: signAccessToken(user, existing.id),
    refreshToken: nextToken, user: publicUser(user) };
};

export const revokeAllSessions = async (userId) => {
  const sessions = await mongoCollection("auth_sessions");
  const result = await sessions.updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: new Date() } });
  return result.modifiedCount;
};
export const listActiveSessions = async (userId, currentSessionId) => {
  const sessions = await mongoCollection("auth_sessions");
  const now = new Date();
  const rows = await sessions.find({ user_id: userId, revoked_at: null,
    expires_at: { $gt: now }, absolute_expires_at: { $gt: now } }).toArray();
  rows.sort((a, b) => Number(b.id === currentSessionId) - Number(a.id === currentSessionId)
    || new Date(b.last_used_at || b.created_at) - new Date(a.last_used_at || a.created_at));
  return rows.map((row) => ({ id: row.id, createdAt: row.created_at,
    lastUsedAt: row.last_used_at, expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at, userAgent: row.user_agent,
    ipAddress: row.ip_address, current: row.id === currentSessionId }));
};
export const revokeOwnedSession = async (userId, sessionId) => {
  const sessions = await mongoCollection("auth_sessions");
  const result = await sessions.updateOne({ id: sessionId, user_id: userId, revoked_at: null },
    { $set: { revoked_at: new Date() } });
  if (result.modifiedCount === 1) return "revoked";
  return await sessions.findOne({ id: sessionId, user_id: userId }) ? "already_revoked" : "not_found";
};
export const revokeOtherSessions = async (userId, currentSessionId) => {
  const sessions = await mongoCollection("auth_sessions");
  const result = await sessions.updateMany({ user_id: userId, id: { $ne: currentSessionId }, revoked_at: null },
    { $set: { revoked_at: new Date() } });
  return result.modifiedCount;
};

const binaryBuffer = (value) => Buffer.isBuffer(value) ? value : Buffer.from(value.buffer);
const encryptedSecret = (user) => ({ ciphertext: binaryBuffer(user.mfa_secret_ciphertext),
  iv: binaryBuffer(user.mfa_secret_iv), tag: binaryBuffer(user.mfa_secret_tag) });
const verifyTotpFactor = async (user, code, session) => {
  if (!user.mfa_secret_ciphertext || !user.mfa_secret_iv || !user.mfa_secret_tag) return null;
  const step = validateTotp(decryptTotpSecret(encryptedSecret(user)), code);
  if (step === null) return null;
  const users = await mongoCollection("users");
  const result = await users.updateOne({ id: user.id,
    $or: [{ mfa_last_used_step: null }, { mfa_last_used_step: { $lt: step } }] },
  { $set: { mfa_last_used_step: step } }, session ? { session } : undefined);
  return result.modifiedCount === 1 ? "totp" : null;
};
const verifyMfaFactor = async (user, code, session) => {
  const totp = await verifyTotpFactor(user, code, session);
  if (totp) return totp;
  const hash = hashRecoveryCode(code);
  if (!hash) return null;
  const recovery = await mongoCollection("auth_mfa_recovery_codes");
  const result = await recovery.updateOne({ user_id: user.id, code_hash: hash, used_at: null },
    { $set: { used_at: new Date() } }, session ? { session } : undefined);
  return result.modifiedCount === 1 ? "recovery" : null;
};

export const getMfaStatus = async (userId) => {
  const { users, recovery } = await collections();
  const user = await users.findOne({ id: userId, status: "active" });
  if (!user) return null;
  return { enabled: Boolean(user.mfa_enabled), enabledAt: user.mfa_enabled_at,
    recoveryCodesRemaining: await recovery.countDocuments({ user_id: userId, used_at: null }) };
};
export const beginMfaSetup = async (userId, currentPassword) => withMongoTransaction(async (session) => {
  const { users, recovery } = await collections();
  const user = await users.findOne({ id: userId }, { session });
  if (!user || user.provider !== "local" || user.status !== "active" || !user.password
      || !(await bcrypt.compare(currentPassword, user.password))) return { error: "invalid_current" };
  if (user.mfa_enabled) return { error: "already_enabled" };
  const enrollment = createTotpEnrollment(user.email);
  const encrypted = encryptTotpSecret(enrollment.secret);
  await users.updateOne({ id: userId }, { $set: {
    mfa_secret_ciphertext: encrypted.ciphertext, mfa_secret_iv: encrypted.iv,
    mfa_secret_tag: encrypted.tag, mfa_enabled: 0, mfa_enabled_at: null,
    mfa_last_used_step: null,
  } }, { session });
  await recovery.deleteMany({ user_id: userId }, { session });
  return enrollment;
});
export const enableMfa = async (userId, code) => withMongoTransaction(async (session) => {
  const { users, sessions, challenges, recovery } = await collections();
  const user = await users.findOne({ id: userId }, { session });
  if (!user || user.provider !== "local" || user.status !== "active" || user.mfa_enabled
      || !user.mfa_secret_ciphertext) return { error: "invalid_setup" };
  const secret = decryptTotpSecret(encryptedSecret(user));
  if (validateTotp(secret, code) === null) return { error: "invalid_code" };
  const recoveryCodes = createRecoveryCodes();
  await recovery.deleteMany({ user_id: userId }, { session });
  for (const recoveryCode of recoveryCodes) {
    const id = await nextNumericId("auth_mfa_recovery_codes");
    await recovery.insertOne({ _id: id, id, user_id: userId,
      code_hash: hashRecoveryCode(recoveryCode), created_at: new Date(), used_at: null }, { session });
  }
  const now = new Date();
  await users.updateOne({ id: userId }, { $set: { mfa_enabled: 1, mfa_enabled_at: now } }, { session });
  await sessions.updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: now } }, { session });
  await challenges.updateMany({ user_id: userId, used_at: null }, { $set: { used_at: now } }, { session });
  return { recoveryCodes };
});

export const completeMfaChallenge = async (challengeToken, code, metadata = {}) =>
  withMongoTransaction(async (session) => {
    const { users, challenges } = await collections();
    const challenge = await challenges.findOne({ token_hash: hashOpaqueToken(challengeToken), used_at: null }, { session });
    const user = challenge ? await users.findOne({ id: challenge.user_id }, { session }) : null;
    const now = new Date();
    if (!challenge || !user || user.status !== "active" || !user.mfa_enabled
        || challenge.attempts >= challenge.max_attempts || challenge.expires_at <= now) {
      if (challenge) await challenges.updateOne({ id: challenge.id }, { $set: { used_at: now } }, { session });
      securityLog("MFA_VERIFY_FAILED", { userId: user?.id, ip: metadata.ipAddress,
        userAgent: metadata.userAgent, reason: challenge ? "invalid_challenge" : "unknown_challenge" });
      return null;
    }
    const factor = await verifyMfaFactor(user, code, session);
    if (!factor) {
      const attempts = challenge.attempts + 1;
      await challenges.updateOne({ id: challenge.id, used_at: null }, { $set: {
        attempts, used_at: attempts >= challenge.max_attempts ? now : null,
      } }, { session });
      securityLog("MFA_VERIFY_FAILED", { userId: user.id, ip: metadata.ipAddress,
        userAgent: metadata.userAgent, reason: "invalid_factor" });
      return null;
    }
    const claimed = await challenges.updateOne({ id: challenge.id, used_at: null },
      { $set: { used_at: now } }, { session });
    if (claimed.modifiedCount !== 1) return null;
    await users.updateOne({ id: user.id }, { $set: { last_login: now } }, { session });
    const result = await createSession(user, metadata, session);
    if (factor === "recovery") securityLog("MFA_RECOVERY_USED", { userId: user.id,
      sessionId: result.sessionId, ip: metadata.ipAddress, userAgent: metadata.userAgent });
    securityLog("MFA_LOGIN_SUCCESS", { userId: user.id, sessionId: result.sessionId,
      ip: metadata.ipAddress, userAgent: metadata.userAgent, factor });
    return result;
  });

export const disableMfa = async (userId, currentPassword, code, metadata = {}) =>
  withMongoTransaction(async (session) => {
    const { users, sessions, challenges, recovery } = await collections();
    const user = await users.findOne({ id: userId }, { session });
    if (!user || user.provider !== "local" || user.status !== "active" || !user.mfa_enabled
        || !user.password || !(await bcrypt.compare(currentPassword, user.password))) return false;
    const factor = await verifyMfaFactor(user, code, session);
    if (!factor) return false;
    const now = new Date();
    await users.updateOne({ id: userId }, { $set: {
      mfa_enabled: 0, mfa_secret_ciphertext: null, mfa_secret_iv: null, mfa_secret_tag: null,
      mfa_enabled_at: null, mfa_last_used_step: null,
    } }, { session });
    await recovery.updateMany({ user_id: userId, used_at: null }, { $set: { used_at: now } }, { session });
    await challenges.updateMany({ user_id: userId, used_at: null }, { $set: { used_at: now } }, { session });
    await sessions.updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: now } }, { session });
    if (factor === "recovery") securityLog("MFA_RECOVERY_USED", { userId,
      ip: metadata.ipAddress, userAgent: metadata.userAgent });
    return true;
  });
export const regenerateMfaRecoveryCodes = async (userId, currentPassword, code) =>
  withMongoTransaction(async (session) => {
    const { users, recovery } = await collections();
    const user = await users.findOne({ id: userId }, { session });
    if (!user || user.provider !== "local" || user.status !== "active" || !user.mfa_enabled
        || !user.password || !(await bcrypt.compare(currentPassword, user.password))
        || !(await verifyTotpFactor(user, code, session))) return null;
    const recoveryCodes = createRecoveryCodes();
    await recovery.deleteMany({ user_id: userId }, { session });
    for (const recoveryCode of recoveryCodes) {
      const id = await nextNumericId("auth_mfa_recovery_codes");
      await recovery.insertOne({ _id: id, id, user_id: userId,
        code_hash: hashRecoveryCode(recoveryCode), created_at: new Date(), used_at: null }, { session });
    }
    return { recoveryCodes };
  });

export const changePassword = async (userId, currentPassword, newPassword) => {
  await ensureNotificationIndexes();
  const result = await withMongoTransaction(async (session) => {
    const { users, sessions } = await collections();
    const user = await users.findOne({ id: userId, status: "active" }, { session });
    if (!user || user.provider !== "local" || !user.password
        || !(await bcrypt.compare(currentPassword, user.password))) return { error: "invalid_current" };
    if (await bcrypt.compare(newPassword, user.password)) return { error: "same_password" };
    const now = new Date();
    await users.updateOne({ id: userId }, { $set: {
      password: await bcrypt.hash(newPassword, bcryptCost), password_changed_at: now,
    } }, { session });
    await sessions.updateMany({ user_id: userId, revoked_at: null }, { $set: { revoked_at: now } }, { session });
    const notification = await createNotification({ recipientId: userId, type: 'security',
      title: 'Mật khẩu đã thay đổi', message: 'Mật khẩu tài khoản của bạn đã được thay đổi thành công.',
      entityType: 'user', entityId: userId, redirectUrl: '/settings?tab=security',
      deduplicationKey: `password-changed:${userId}:${now.getTime()}`, session });
    return { success: true, changedAt: now, notification };
  });
  emitStoredNotification(result.notification);
  return result;
};
export const requestPasswordReset = async (email) => {
  const { users, resets } = await collections();
  const user = await users.findOne({ email, provider: "local", status: "active", password: { $ne: null } });
  if (!user) return null;
  if (!passwordResetDeliveryAvailable()) {
    await resets.updateMany({ user_id: user.id, used_at: null }, { $set: { used_at: new Date() } });
    return { userId: user.id };
  }
  const rawToken = newPasswordResetToken();
  const tokenHash = hashToken(rawToken);
  await withMongoTransaction(async (session) => {
    await resets.updateMany({ user_id: user.id, used_at: null }, { $set: { used_at: new Date() } }, { session });
    const id = await nextNumericId("password_reset_tokens");
    await resets.insertOne({ _id: id, id, user_id: user.id, token_hash: tokenHash,
      created_at: new Date(), expires_at: future(securityConfig.passwordReset.tokenTtlMinutes, MINUTE),
      used_at: null }, { session });
  });
  try { await deliverPasswordReset({ email: user.email, token: rawToken }); }
  catch { await resets.updateOne({ token_hash: tokenHash, used_at: null }, { $set: { used_at: new Date() } }); }
  return { userId: user.id };
};
export const resetPassword = async (rawToken, newPassword) => {
  await ensureNotificationIndexes();
  const result = await withMongoTransaction(async (session) => {
    const { users, sessions, resets } = await collections();
    const now = new Date();
    const token = await resets.findOne({ token_hash: hashToken(rawToken), used_at: null,
      expires_at: { $gt: now } }, { session });
    const user = token ? await users.findOne({ id: token.user_id, provider: "local",
      status: "active", password: { $ne: null } }, { session }) : null;
    if (!user || await bcrypt.compare(newPassword, user.password)) return null;
    const claimed = await resets.updateOne({ id: token.id, used_at: null, expires_at: { $gt: now } },
      { $set: { used_at: now } }, { session });
    if (claimed.modifiedCount !== 1) return null;
    await users.updateOne({ id: user.id }, { $set: {
      password: await bcrypt.hash(newPassword, bcryptCost), password_changed_at: now,
    } }, { session });
    await resets.updateMany({ user_id: user.id, used_at: null }, { $set: { used_at: now } }, { session });
    await sessions.updateMany({ user_id: user.id, revoked_at: null }, { $set: { revoked_at: now } }, { session });
    const notification = await createNotification({ recipientId: user.id, type: 'security',
      title: 'Mật khẩu đã đặt lại', message: 'Mật khẩu tài khoản của bạn đã được đặt lại thành công.',
      entityType: 'user', entityId: user.id, redirectUrl: '/settings?tab=security',
      deduplicationKey: `password-reset:${user.id}:${now.getTime()}`, session });
    return { success: true, userId: user.id, changedAt: now, notification };
  });
  if (result) emitStoredNotification(result.notification);
  return result;
};
export const revokeSession = async ({ refreshToken, accessToken }) => {
  const sessions = await mongoCollection("auth_sessions");
  if (refreshToken) await sessions.updateOne({ refresh_token_hash: hashToken(refreshToken), revoked_at: null },
    { $set: { revoked_at: new Date() } });
  let sessionId;
  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, securityConfig.jwtAccessSecret,
        { algorithms: securityConfig.jwtAlgorithms, ignoreExpiration: true });
      sessionId = payload.sid;
      await sessions.updateOne({ id: sessionId, revoked_at: null }, { $set: { revoked_at: new Date() } });
    } catch { /* Logout is idempotent for malformed access tokens. */ }
  }
  return { sessionId };
};
