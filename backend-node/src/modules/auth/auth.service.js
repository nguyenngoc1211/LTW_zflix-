import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { securityConfig } from "../../config/security.config.js";
import { pool } from "../../core/database/pool.js";
import {
  deliverPasswordReset,
  passwordResetDeliveryAvailable,
} from "./password-reset-delivery.js";
import {
  createMfaChallengeToken,
  createRecoveryCodes,
  createTotpEnrollment,
  decryptTotpSecret,
  encryptTotpSecret,
  hashOpaqueToken,
  hashRecoveryCode,
  validateTotp,
} from "./mfa.js";

export const REFRESH_COOKIE = "refreshToken";

const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || "15m";
const bcryptCost = 12;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const newRefreshToken = () => crypto.randomBytes(48).toString("base64url");
const newPasswordResetToken = () => crypto.randomBytes(32).toString("base64url");

const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  avatarUrl: row.avatar_url,
  role: row.role,
});

const signAccessToken = (user, sessionId) =>
  jwt.sign(
    { role: user.role, sid: sessionId },
    securityConfig.jwtAccessSecret,
    { subject: String(user.id), expiresIn: accessTokenTtl, algorithm: "HS256" },
  );

const createSession = async (executor, user, metadata = {}) => {
  const sessionId = crypto.randomUUID();
  const refreshToken = newRefreshToken();
  await executor.execute(
    `INSERT INTO auth_sessions
       (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at,
        absolute_expires_at)
     VALUES (?, ?, ?, ?, ?,
             DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY),
             DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
    [
      sessionId,
      user.id,
      hashToken(refreshToken),
      metadata.userAgent?.slice(0, 255) || null,
      metadata.ipAddress?.slice(0, 45) || null,
      securityConfig.refreshSession.idleTtlDays,
      securityConfig.refreshSession.absoluteTtlDays,
    ],
  );
  return {
    accessToken: signAccessToken(user, sessionId),
    refreshToken,
    user: publicUser(user),
  };
};

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: securityConfig.isProduction,
  sameSite: "lax",
  path: "/api/v1/auth",
  maxAge: securityConfig.refreshSession.idleTtlDays * 24 * 60 * 60 * 1000,
});

export const clearRefreshCookieOptions = () => {
  const { maxAge, ...options } = refreshCookieOptions();
  return options;
};

export const login = async (email, password, metadata = {}) => {
  const [users] = await pool.execute(
    `SELECT id, username, email, password, avatar_url, role, provider,
            status, failed_login_attempts, locked_until, mfa_enabled
     FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  const user = users[0];

  if (!user || user.provider !== "local" || !user.password) return null;
  if (user.status !== "active") return { denied: "disabled" };
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    return { denied: "locked" };
  }

  if (!(await bcrypt.compare(password, user.password))) {
    await pool.execute(
      `UPDATE users
       SET failed_login_attempts = IF(
             locked_until IS NOT NULL AND locked_until <= UTC_TIMESTAMP(),
             1,
             failed_login_attempts + 1
           ),
           locked_until = IF(
             failed_login_attempts >= ?,
             DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE),
             NULL
           )
       WHERE id = ?`,
      [
        securityConfig.accountLock.maxFailedAttempts,
        securityConfig.accountLock.minutes,
        user.id,
      ],
    );

    const [attemptRows] = await pool.execute(
      "SELECT locked_until FROM users WHERE id = ? LIMIT 1",
      [user.id],
    );
    return attemptRows[0]?.locked_until ? { denied: "locked" } : null;
  }

  await pool.execute(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL
     WHERE id = ?`,
    [user.id],
  );

  if (user.mfa_enabled) {
    const challengeToken = createMfaChallengeToken();
    await pool.execute(
      `UPDATE auth_mfa_challenges
       SET used_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND used_at IS NULL`,
      [user.id],
    );
    await pool.execute(
      `INSERT INTO auth_mfa_challenges
         (user_id, token_hash, expires_at, max_attempts)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), ?)`,
      [
        user.id,
        hashOpaqueToken(challengeToken),
        securityConfig.mfa.challengeTtlSeconds,
        securityConfig.mfa.challengeMaxAttempts,
      ],
    );
    return {
      mfaRequired: true,
      challengeToken,
      expiresInSeconds: securityConfig.mfa.challengeTtlSeconds,
    };
  }

  await pool.execute("UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id = ?", [user.id]);
  return createSession(pool, user, metadata);
};

export const refresh = async (currentToken) => {
  const currentHash = hashToken(currentToken);
  const [rows] = await pool.execute(
    `SELECT s.id AS session_id, s.expires_at, s.absolute_expires_at,
            u.id, u.username, u.email, u.avatar_url, u.role, u.status
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = ? AND s.revoked_at IS NULL
     LIMIT 1`,
    [currentHash],
  );
  const user = rows[0];
  if (!user) return null;

  const now = Date.now();
  const absoluteExpired =
    !user.absolute_expires_at || new Date(user.absolute_expires_at).getTime() <= now;
  if (user.status !== "active" || absoluteExpired) {
    await pool.execute(
      "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL",
      [user.session_id],
    );
    return null;
  }
  if (new Date(user.expires_at).getTime() <= now) return null;

  const nextToken = newRefreshToken();
  const [result] = await pool.execute(
    `UPDATE auth_sessions s
     JOIN users u ON u.id = s.user_id
     SET s.refresh_token_hash = ?,
         s.expires_at = LEAST(
           DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY),
           s.absolute_expires_at
         ),
         s.last_used_at = UTC_TIMESTAMP()
     WHERE s.id = ? AND s.refresh_token_hash = ? AND s.revoked_at IS NULL
       AND s.expires_at > UTC_TIMESTAMP()
       AND s.absolute_expires_at > UTC_TIMESTAMP()
       AND u.status = 'active'`,
    [
      hashToken(nextToken),
      securityConfig.refreshSession.idleTtlDays,
      user.session_id,
      currentHash,
    ],
  );
  if (result.affectedRows !== 1) return null;

  return {
    accessToken: signAccessToken(user, user.session_id),
    refreshToken: nextToken,
    user: publicUser(user),
  };
};

export const revokeAllSessions = async (userId) => {
  await pool.execute(
    `UPDATE auth_sessions
     SET revoked_at = UTC_TIMESTAMP()
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  );
};

const verifyTotpFactor = async (connection, user, code) => {
  if (
    user.mfa_secret_ciphertext &&
    user.mfa_secret_iv &&
    user.mfa_secret_tag
  ) {
    const secret = decryptTotpSecret({
      ciphertext: user.mfa_secret_ciphertext,
      iv: user.mfa_secret_iv,
      tag: user.mfa_secret_tag,
    });
    const acceptedStep = validateTotp(secret, code);
    if (acceptedStep !== null) {
      const [updated] = await connection.execute(
        `UPDATE users
         SET mfa_last_used_step = ?
         WHERE id = ?
           AND (mfa_last_used_step IS NULL OR mfa_last_used_step < ?)`,
        [acceptedStep, user.id, acceptedStep],
      );
      if (updated.affectedRows === 1) return true;
    }
  }

  return false;
};

const verifyMfaFactor = async (connection, user, code) => {
  if (await verifyTotpFactor(connection, user, code)) return true;

  const recoveryHash = hashRecoveryCode(code);
  if (!recoveryHash) return false;
  const [codes] = await connection.execute(
    `SELECT id
     FROM auth_mfa_recovery_codes
     WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
     LIMIT 1
     FOR UPDATE`,
    [user.id, recoveryHash],
  );
  if (codes.length === 0) return false;
  const [consumed] = await connection.execute(
    `UPDATE auth_mfa_recovery_codes
     SET used_at = UTC_TIMESTAMP()
     WHERE id = ? AND used_at IS NULL`,
    [codes[0].id],
  );
  return consumed.affectedRows === 1;
};

export const getMfaStatus = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT mfa_enabled, mfa_enabled_at,
            (SELECT COUNT(*)
             FROM auth_mfa_recovery_codes
             WHERE user_id = users.id AND used_at IS NULL) AS recovery_codes_remaining
     FROM users
     WHERE id = ? AND status = 'active'
     LIMIT 1`,
    [userId],
  );
  const status = rows[0];
  if (!status) return null;
  return {
    enabled: Boolean(status.mfa_enabled),
    enabledAt: status.mfa_enabled_at,
    recoveryCodesRemaining: Number(status.recovery_codes_remaining),
  };
};

export const beginMfaSetup = async (userId, currentPassword) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      `SELECT id, email, password, provider, status, mfa_enabled
       FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const user = users[0];
    if (!user || user.provider !== "local" || user.status !== "active" || !user.password) {
      await connection.rollback();
      return { error: "invalid_current" };
    }
    if (user.mfa_enabled) {
      await connection.rollback();
      return { error: "already_enabled" };
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      await connection.rollback();
      return { error: "invalid_current" };
    }

    const enrollment = createTotpEnrollment(user.email);
    const encrypted = encryptTotpSecret(enrollment.secret);
    await connection.execute(
      `UPDATE users
       SET mfa_secret_ciphertext = ?, mfa_secret_iv = ?, mfa_secret_tag = ?,
           mfa_enabled = 0, mfa_enabled_at = NULL, mfa_last_used_step = NULL
       WHERE id = ?`,
      [encrypted.ciphertext, encrypted.iv, encrypted.tag, user.id],
    );
    await connection.execute("DELETE FROM auth_mfa_recovery_codes WHERE user_id = ?", [user.id]);
    await connection.commit();
    return enrollment;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const enableMfa = async (userId, code) => {
  const recoveryCodes = createRecoveryCodes();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      `SELECT id, provider, status, mfa_enabled, mfa_secret_ciphertext,
              mfa_secret_iv, mfa_secret_tag, mfa_last_used_step
       FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const user = users[0];
    if (
      !user ||
      user.provider !== "local" ||
      user.status !== "active" ||
      user.mfa_enabled ||
      !user.mfa_secret_ciphertext
    ) {
      await connection.rollback();
      return { error: "invalid_setup" };
    }
    const enrollmentSecret = decryptTotpSecret({
      ciphertext: user.mfa_secret_ciphertext,
      iv: user.mfa_secret_iv,
      tag: user.mfa_secret_tag,
    });
    if (validateTotp(enrollmentSecret, code) === null) {
      await connection.rollback();
      return { error: "invalid_code" };
    }

    await connection.execute("DELETE FROM auth_mfa_recovery_codes WHERE user_id = ?", [user.id]);
    for (const recoveryCode of recoveryCodes) {
      await connection.execute(
        "INSERT INTO auth_mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)",
        [user.id, hashRecoveryCode(recoveryCode)],
      );
    }
    await connection.execute(
      "UPDATE users SET mfa_enabled = 1, mfa_enabled_at = UTC_TIMESTAMP() WHERE id = ?",
      [user.id],
    );
    await connection.execute(
      "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL",
      [user.id],
    );
    await connection.execute(
      "UPDATE auth_mfa_challenges SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL",
      [user.id],
    );
    await connection.commit();
    return { recoveryCodes };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const completeMfaChallenge = async (challengeToken, code, metadata = {}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT c.id AS challenge_id, c.attempts, c.max_attempts, c.expires_at,
              u.id, u.username, u.email, u.avatar_url, u.role, u.status,
              u.mfa_enabled, u.mfa_secret_ciphertext, u.mfa_secret_iv,
              u.mfa_secret_tag, u.mfa_last_used_step
       FROM auth_mfa_challenges c
       JOIN users u ON u.id = c.user_id
       WHERE c.token_hash = ? AND c.used_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [hashOpaqueToken(challengeToken)],
    );
    const challenge = rows[0];
    if (
      !challenge ||
      challenge.status !== "active" ||
      !challenge.mfa_enabled ||
      challenge.attempts >= challenge.max_attempts ||
      new Date(challenge.expires_at).getTime() <= Date.now()
    ) {
      if (challenge) {
        await connection.execute(
          "UPDATE auth_mfa_challenges SET used_at = UTC_TIMESTAMP() WHERE id = ?",
          [challenge.challenge_id],
        );
        await connection.commit();
      } else {
        await connection.rollback();
      }
      return null;
    }

    if (!(await verifyMfaFactor(connection, challenge, code))) {
      await connection.execute(
        `UPDATE auth_mfa_challenges
         SET attempts = attempts + 1,
             used_at = IF(attempts >= max_attempts, UTC_TIMESTAMP(), used_at)
         WHERE id = ?`,
        [challenge.challenge_id],
      );
      await connection.commit();
      return null;
    }

    await connection.execute(
      "UPDATE auth_mfa_challenges SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL",
      [challenge.challenge_id],
    );
    await connection.execute(
      "UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id = ?",
      [challenge.id],
    );
    const result = await createSession(connection, challenge, metadata);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const disableMfa = async (userId, currentPassword, code) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      `SELECT id, password, provider, status, mfa_enabled, mfa_secret_ciphertext,
              mfa_secret_iv, mfa_secret_tag, mfa_last_used_step
       FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const user = users[0];
    if (
      !user ||
      user.provider !== "local" ||
      user.status !== "active" ||
      !user.mfa_enabled ||
      !user.password ||
      !(await bcrypt.compare(currentPassword, user.password)) ||
      !(await verifyMfaFactor(connection, user, code))
    ) {
      await connection.rollback();
      return false;
    }

    await connection.execute(
      `UPDATE users
       SET mfa_enabled = 0, mfa_secret_ciphertext = NULL, mfa_secret_iv = NULL,
           mfa_secret_tag = NULL, mfa_enabled_at = NULL, mfa_last_used_step = NULL
       WHERE id = ?`,
      [user.id],
    );
    await connection.execute(
      `UPDATE auth_mfa_recovery_codes
       SET used_at = COALESCE(used_at, UTC_TIMESTAMP())
       WHERE user_id = ?`,
      [user.id],
    );
    await connection.execute(
      "UPDATE auth_mfa_challenges SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL",
      [user.id],
    );
    await connection.execute(
      "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL",
      [user.id],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const regenerateMfaRecoveryCodes = async (userId, currentPassword, code) => {
  const recoveryCodes = createRecoveryCodes();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      `SELECT id, password, provider, status, mfa_enabled, mfa_secret_ciphertext,
              mfa_secret_iv, mfa_secret_tag, mfa_last_used_step
       FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
      [userId],
    );
    const user = users[0];
    if (
      !user ||
      user.provider !== "local" ||
      user.status !== "active" ||
      !user.mfa_enabled ||
      !user.password ||
      !(await bcrypt.compare(currentPassword, user.password)) ||
      !(await verifyTotpFactor(connection, user, code))
    ) {
      await connection.rollback();
      return null;
    }

    await connection.execute("DELETE FROM auth_mfa_recovery_codes WHERE user_id = ?", [user.id]);
    for (const recoveryCode of recoveryCodes) {
      await connection.execute(
        "INSERT INTO auth_mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)",
        [user.id, hashRecoveryCode(recoveryCode)],
      );
    }
    await connection.commit();
    return { recoveryCodes };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute(
      `SELECT password, provider
       FROM users
       WHERE id = ? AND status = 'active'
       LIMIT 1
       FOR UPDATE`,
      [userId],
    );
    const user = users[0];
    if (!user || user.provider !== "local" || !user.password) {
      await connection.rollback();
      return { error: "invalid_current" };
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      await connection.rollback();
      return { error: "invalid_current" };
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      await connection.rollback();
      return { error: "same_password" };
    }

    const passwordHash = await bcrypt.hash(newPassword, bcryptCost);
    await connection.execute(
      `UPDATE users
       SET password = ?, password_changed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [passwordHash, userId],
    );
    await connection.execute(
      `UPDATE auth_sessions
       SET revoked_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND revoked_at IS NULL`,
      [userId],
    );
    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const requestPasswordReset = async (email) => {
  const [users] = await pool.execute(
    `SELECT id, email
     FROM users
     WHERE email = ? AND provider = 'local' AND status = 'active' AND password IS NOT NULL
     LIMIT 1`,
    [email],
  );
  const user = users[0];
  if (!user) return;
  if (!passwordResetDeliveryAvailable()) {
    await pool.execute(
      `UPDATE password_reset_tokens
       SET used_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND used_at IS NULL`,
      [user.id],
    );
    return;
  }

  const rawToken = newPasswordResetToken();
  const tokenHash = hashToken(rawToken);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [user.id]);
    await connection.execute(
      `UPDATE password_reset_tokens
       SET used_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND used_at IS NULL`,
      [user.id],
    );
    await connection.execute(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
      [user.id, tokenHash, securityConfig.passwordReset.tokenTtlMinutes],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  try {
    await deliverPasswordReset({ email: user.email, token: rawToken });
  } catch {
    await pool.execute(
      `UPDATE password_reset_tokens
       SET used_at = UTC_TIMESTAMP()
       WHERE token_hash = ? AND used_at IS NULL`,
      [tokenHash],
    );
  }
};

export const resetPassword = async (rawToken, newPassword) => {
  const tokenHash = hashToken(rawToken);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT prt.id AS reset_id, prt.user_id, u.password
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?
         AND prt.used_at IS NULL
         AND prt.expires_at > UTC_TIMESTAMP()
         AND u.provider = 'local'
         AND u.status = 'active'
         AND u.password IS NOT NULL
       LIMIT 1
       FOR UPDATE`,
      [tokenHash],
    );
    const reset = rows[0];
    if (!reset || (await bcrypt.compare(newPassword, reset.password))) {
      await connection.rollback();
      return false;
    }

    const [claimed] = await connection.execute(
      `UPDATE password_reset_tokens
       SET used_at = UTC_TIMESTAMP()
       WHERE id = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [reset.reset_id],
    );
    if (claimed.affectedRows !== 1) {
      await connection.rollback();
      return false;
    }

    const passwordHash = await bcrypt.hash(newPassword, bcryptCost);
    await connection.execute(
      `UPDATE users
       SET password = ?, password_changed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [passwordHash, reset.user_id],
    );
    await connection.execute(
      `UPDATE password_reset_tokens
       SET used_at = COALESCE(used_at, UTC_TIMESTAMP())
       WHERE user_id = ? AND used_at IS NULL`,
      [reset.user_id],
    );
    await connection.execute(
      `UPDATE auth_sessions
       SET revoked_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND revoked_at IS NULL`,
      [reset.user_id],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const revokeSession = async ({ refreshToken, accessToken }) => {
  if (refreshToken) {
    await pool.execute(
      "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE refresh_token_hash = ? AND revoked_at IS NULL",
      [hashToken(refreshToken)],
    );
  }

  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, securityConfig.jwtAccessSecret, {
        algorithms: securityConfig.jwtAlgorithms,
        ignoreExpiration: true,
      });
      await pool.execute(
        "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL",
        [payload.sid],
      );
    } catch {
      // Logout remains idempotent when the supplied access token is malformed.
    }
  }
};
