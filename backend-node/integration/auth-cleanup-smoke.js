import assert from "node:assert/strict";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const { cleanupAuthData } = await import("../src/modules/auth/auth-cleanup.js");
const { securityConfig } = await import("../src/config/security.config.js");
const { pool } = await import("../src/core/database/pool.js");

const userId = 2;
const dayMs = 24 * 60 * 60 * 1000;
const future = new Date(Date.now() + 10 * dayMs);
const recentPast = new Date(Date.now() - dayMs);
const oldDate = (retentionDays) => new Date(Date.now() - (retentionDays + 2) * dayMs);
const randomHash = () => crypto.randomBytes(32).toString("hex");
const sessionIds = [];
const resetIds = [];
const challengeIds = [];
const recoveryIds = [];

const insertSession = async ({ expiresAt = future, absoluteExpiresAt = future, revokedAt = null }) => {
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO auth_sessions
       (id, user_id, refresh_token_hash, expires_at, absolute_expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, randomHash(), expiresAt, absoluteExpiresAt, revokedAt],
  );
  sessionIds.push(id);
  return id;
};

try {
  const activeSessionId = await insertSession({});
  const recentExpiredSessionId = await insertSession({ expiresAt: recentPast });
  const oldExpiredSessionId = await insertSession({
    expiresAt: oldDate(securityConfig.cleanup.sessionRetentionDays),
  });
  const oldAbsoluteExpiredSessionId = await insertSession({
    absoluteExpiresAt: oldDate(securityConfig.cleanup.sessionRetentionDays),
  });
  const oldRevokedSessionId = await insertSession({
    revokedAt: oldDate(securityConfig.cleanup.sessionRetentionDays),
  });

  const [validReset] = await pool.execute(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [userId, randomHash(), future],
  );
  resetIds.push(validReset.insertId);
  const [expiredReset] = await pool.execute(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [userId, randomHash(), oldDate(securityConfig.cleanup.passwordResetRetentionDays)],
  );
  resetIds.push(expiredReset.insertId);
  const [usedReset] = await pool.execute(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at)
     VALUES (?, ?, ?, ?)`,
    [userId, randomHash(), future, oldDate(securityConfig.cleanup.passwordResetRetentionDays)],
  );
  resetIds.push(usedReset.insertId);

  const [activeChallenge] = await pool.execute(
    `INSERT INTO auth_mfa_challenges (user_id, token_hash, max_attempts, expires_at)
     VALUES (?, ?, 5, ?)`,
    [userId, randomHash(), future],
  );
  challengeIds.push(activeChallenge.insertId);
  const [expiredChallenge] = await pool.execute(
    `INSERT INTO auth_mfa_challenges (user_id, token_hash, max_attempts, expires_at)
     VALUES (?, ?, 5, ?)`,
    [userId, randomHash(), oldDate(securityConfig.cleanup.mfaChallengeRetentionDays)],
  );
  challengeIds.push(expiredChallenge.insertId);
  const [usedChallenge] = await pool.execute(
    `INSERT INTO auth_mfa_challenges (user_id, token_hash, max_attempts, expires_at, used_at)
     VALUES (?, ?, 5, ?, ?)`,
    [userId, randomHash(), future, oldDate(securityConfig.cleanup.mfaChallengeRetentionDays)],
  );
  challengeIds.push(usedChallenge.insertId);

  const [activeRecovery] = await pool.execute(
    "INSERT INTO auth_mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)",
    [userId, randomHash()],
  );
  recoveryIds.push(activeRecovery.insertId);
  const [oldUsedRecovery] = await pool.execute(
    `INSERT INTO auth_mfa_recovery_codes (user_id, code_hash, used_at)
     VALUES (?, ?, ?)`,
    [userId, randomHash(), oldDate(securityConfig.cleanup.usedRecoveryCodeRetentionDays)],
  );
  recoveryIds.push(oldUsedRecovery.insertId);
  const [recentUsedRecovery] = await pool.execute(
    `INSERT INTO auth_mfa_recovery_codes (user_id, code_hash, used_at)
     VALUES (?, ?, ?)`,
    [userId, randomHash(), recentPast],
  );
  recoveryIds.push(recentUsedRecovery.insertId);

  const result = await cleanupAuthData();
  assert.ok(result.auth_sessions_deleted >= 3);
  assert.ok(result.password_reset_tokens_deleted >= 2);
  assert.ok(result.mfa_challenges_deleted >= 2);
  assert.ok(result.used_recovery_codes_deleted >= 1);

  const [remainingSessions] = await pool.query(
    "SELECT id FROM auth_sessions WHERE id IN (?)",
    [sessionIds],
  );
  assert.deepEqual(
    new Set(remainingSessions.map((row) => row.id)),
    new Set([activeSessionId, recentExpiredSessionId]),
  );
  assert.equal(
    remainingSessions.some((row) => row.id === oldAbsoluteExpiredSessionId),
    false,
  );
  const [remainingResets] = await pool.query(
    "SELECT id FROM password_reset_tokens WHERE id IN (?)",
    [resetIds],
  );
  assert.deepEqual(remainingResets.map((row) => row.id), [validReset.insertId]);
  const [remainingChallenges] = await pool.query(
    "SELECT id FROM auth_mfa_challenges WHERE id IN (?)",
    [challengeIds],
  );
  assert.deepEqual(remainingChallenges.map((row) => row.id), [activeChallenge.insertId]);
  const [remainingRecovery] = await pool.query(
    "SELECT id FROM auth_mfa_recovery_codes WHERE id IN (?)",
    [recoveryIds],
  );
  assert.deepEqual(
    new Set(remainingRecovery.map((row) => row.id)),
    new Set([activeRecovery.insertId, recentUsedRecovery.insertId]),
  );

  console.log(`Auth cleanup checks passed: ${JSON.stringify(result)}`);
} finally {
  for (const id of sessionIds) {
    await pool.execute("DELETE FROM auth_sessions WHERE id = ?", [id]);
  }
  for (const id of resetIds) {
    await pool.execute("DELETE FROM password_reset_tokens WHERE id = ?", [id]);
  }
  for (const id of challengeIds) {
    await pool.execute("DELETE FROM auth_mfa_challenges WHERE id = ?", [id]);
  }
  for (const id of recoveryIds) {
    await pool.execute("DELETE FROM auth_mfa_recovery_codes WHERE id = ?", [id]);
  }
  await pool.end();
}
