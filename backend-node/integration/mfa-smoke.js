import assert from "node:assert/strict";
import crypto from "node:crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import * as OTPAuth from "otpauth";
import request from "supertest";

dotenv.config({ path: new URL("../../.env", import.meta.url) });
process.env.LOGIN_RATE_LIMIT_MAX = "1000";
process.env.MFA_RATE_LIMIT_MAX = "1000";
process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX = "1000";
process.env.RESET_PASSWORD_RATE_LIMIT_MAX = "1000";

const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/core/database/pool.js");
const { consumeDevelopmentPasswordReset } = await import(
  "../src/modules/auth/password-reset-delivery.js"
);
const database = await mysql.createConnection({
  uri:
    process.env.DATABASE_URL ||
    "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db",
  timezone: "Z",
});

const userId = 2;
const email = "john.doe@email.com";
const originalPassword = "abc123";
const resetPassword = "Phase4A-reset-password";
const createdSessionIds = new Set();

const call = async (path, { token, cookie, origin, body } = {}) => {
  let pending = request(app).post(path);
  if (token) pending = pending.set("Authorization", `Bearer ${token}`);
  if (cookie) pending = pending.set("Cookie", cookie);
  if (origin) pending = pending.set("Origin", origin);
  if (body !== undefined) pending = pending.send(body);
  const response = await pending;
  return {
    status: response.status,
    data: response.body,
    cookie: response.headers["set-cookie"]
      ?.map((value) => value.split(";")[0])
      .find((value) => value.startsWith("refreshToken=")),
  };
};

const login = (password = originalPassword) =>
  call("/api/v1/auth/login", { body: { email, password } });

const verify = (challengeToken, code) =>
  call("/api/v1/auth/mfa/verify", {
    origin: frontendOrigin,
    body: { challengeToken, code },
  });

const rememberSession = (result) => {
  const sessionId = jwt.decode(result.data.accessToken)?.sid;
  assert.ok(sessionId);
  createdSessionIds.add(sessionId);
  return sessionId;
};

const [[originalUser]] = await database.execute(
  `SELECT password, password_changed_at, status, disabled_at, failed_login_attempts,
          locked_until, last_login, mfa_enabled, mfa_secret_ciphertext,
          mfa_secret_iv, mfa_secret_tag, mfa_enabled_at, mfa_last_used_step
   FROM users WHERE id = ?`,
  [userId],
);
const [originalSessions] = await database.execute(
  "SELECT id, revoked_at FROM auth_sessions WHERE user_id = ?",
  [userId],
);
const [originalChallenges] = await database.execute(
  "SELECT * FROM auth_mfa_challenges WHERE user_id = ?",
  [userId],
);
const [originalRecoveryCodes] = await database.execute(
  "SELECT * FROM auth_mfa_recovery_codes WHERE user_id = ?",
  [userId],
);
const [originalPasswordResetTokens] = await database.execute(
  "SELECT * FROM password_reset_tokens WHERE user_id = ?",
  [userId],
);

try {
  await database.execute("DELETE FROM auth_mfa_challenges WHERE user_id = ?", [userId]);
  await database.execute("DELETE FROM auth_mfa_recovery_codes WHERE user_id = ?", [userId]);
  await database.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);
  await database.execute(
    `UPDATE users
     SET password = ?, status = 'active', disabled_at = NULL,
         failed_login_attempts = 0, locked_until = NULL,
         mfa_enabled = 0, mfa_secret_ciphertext = NULL, mfa_secret_iv = NULL,
         mfa_secret_tag = NULL, mfa_enabled_at = NULL, mfa_last_used_step = NULL
     WHERE id = ?`,
    [originalUser.password, userId],
  );

  const enrollmentSession = await login();
  assert.equal(enrollmentSession.status, 200);
  const enrollmentSessionId = rememberSession(enrollmentSession);

  const wrongSetup = await call("/api/v1/auth/mfa/setup", {
    token: enrollmentSession.data.accessToken,
    origin: frontendOrigin,
    body: { currentPassword: "wrong-password" },
  });
  assert.equal(wrongSetup.status, 400);

  const setup = await call("/api/v1/auth/mfa/setup", {
    token: enrollmentSession.data.accessToken,
    origin: frontendOrigin,
    body: { currentPassword: originalPassword },
  });
  assert.equal(setup.status, 200);
  assert.match(setup.data.secret, /^[A-Z2-7]+$/u);
  assert.match(setup.data.otpauthUrl, /^otpauth:\/\/totp\//u);
  const [[storedSecret]] = await database.execute(
    `SELECT mfa_secret_ciphertext, mfa_secret_iv, mfa_secret_tag
     FROM users WHERE id = ?`,
    [userId],
  );
  assert.ok(storedSecret.mfa_secret_ciphertext);
  assert.notEqual(storedSecret.mfa_secret_ciphertext.toString("utf8"), setup.data.secret);
  assert.equal(storedSecret.mfa_secret_iv.length, 12);
  assert.equal(storedSecret.mfa_secret_tag.length, 16);

  const totp = new OTPAuth.TOTP({
    issuer: "MovieHub",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(setup.data.secret),
  });
  const enable = await call("/api/v1/auth/mfa/enable", {
    token: enrollmentSession.data.accessToken,
    origin: frontendOrigin,
    body: { code: totp.generate() },
  });
  assert.equal(enable.status, 200);
  assert.equal(enable.data.recoveryCodes.length, 10);
  assert.equal(new Set(enable.data.recoveryCodes).size, 10);
  const recoveryCodes = enable.data.recoveryCodes;
  const [[revokedEnrollmentSession]] = await database.execute(
    "SELECT revoked_at FROM auth_sessions WHERE id = ?",
    [enrollmentSessionId],
  );
  assert.ok(revokedEnrollmentSession.revoked_at);
  const [[storedRecovery]] = await database.execute(
    "SELECT code_hash FROM auth_mfa_recovery_codes WHERE user_id = ? LIMIT 1",
    [userId],
  );
  assert.notEqual(storedRecovery.code_hash, recoveryCodes[0]);

  const [[sessionCountBeforeChallenge]] = await database.execute(
    "SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id = ?",
    [userId],
  );
  const challenged = await login();
  assert.equal(challenged.status, 202);
  assert.equal(challenged.data.mfaRequired, true);
  assert.equal("accessToken" in challenged.data, false);
  assert.equal(challenged.cookie, undefined);
  const [[sessionCountAfterChallenge]] = await database.execute(
    "SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id = ?",
    [userId],
  );
  assert.equal(sessionCountAfterChallenge.count, sessionCountBeforeChallenge.count);
  const [[storedChallenge]] = await database.execute(
    "SELECT token_hash FROM auth_mfa_challenges WHERE user_id = ? AND used_at IS NULL",
    [userId],
  );
  assert.equal(
    storedChallenge.token_hash,
    crypto.createHash("sha256").update(challenged.data.challengeToken).digest("hex"),
  );
  assert.notEqual(storedChallenge.token_hash, challenged.data.challengeToken);

  const validationTime = Date.now();
  const validWindowCodes = new Set(
    [-30_000, 0, 30_000].map((offset) => totp.generate({ timestamp: validationTime + offset })),
  );
  let invalidTotp = "000000";
  while (validWindowCodes.has(invalidTotp)) {
    invalidTotp = String(Number(invalidTotp) + 1).padStart(6, "0");
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rejected = await verify(challenged.data.challengeToken, invalidTotp);
    assert.equal(rejected.status, 401);
  }
  const [[exhausted]] = await database.execute(
    "SELECT attempts, max_attempts, used_at FROM auth_mfa_challenges WHERE token_hash = ?",
    [storedChallenge.token_hash],
  );
  assert.equal(exhausted.attempts, exhausted.max_attempts);
  assert.ok(exhausted.used_at);

  const expiredChallenge = await login();
  const expiredHash = crypto
    .createHash("sha256")
    .update(expiredChallenge.data.challengeToken)
    .digest("hex");
  await database.execute(
    "UPDATE auth_mfa_challenges SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE token_hash = ?",
    [expiredHash],
  );
  const [[sessionsBeforeExpiredVerify]] = await database.execute(
    "SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id = ?",
    [userId],
  );
  assert.equal(
    (await verify(expiredChallenge.data.challengeToken, recoveryCodes[9])).status,
    401,
  );
  const [[sessionsAfterExpiredVerify]] = await database.execute(
    "SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id = ?",
    [userId],
  );
  assert.equal(sessionsAfterExpiredVerify.count, sessionsBeforeExpiredVerify.count);

  const totpChallenge = await login();
  const nextStepCode = totp.generate({ timestamp: Date.now() + 30_000 });
  const totpLogin = await verify(totpChallenge.data.challengeToken, nextStepCode);
  assert.equal(totpLogin.status, 200);
  rememberSession(totpLogin);
  assert.equal(
    (await verify(totpChallenge.data.challengeToken, recoveryCodes[9])).status,
    401,
  );

  const replayChallenge = await login();
  assert.equal((await verify(replayChallenge.data.challengeToken, nextStepCode)).status, 401);

  const recoveryChallenge = await login();
  const recoveryLogin = await verify(recoveryChallenge.data.challengeToken, recoveryCodes[0]);
  assert.equal(recoveryLogin.status, 200);
  rememberSession(recoveryLogin);
  const reusedRecoveryChallenge = await login();
  assert.equal(
    (await verify(reusedRecoveryChallenge.data.challengeToken, recoveryCodes[0])).status,
    401,
  );

  const forgot = await call("/api/v1/auth/forgot-password", { body: { email } });
  assert.equal(forgot.status, 200);
  const resetCapture = consumeDevelopmentPasswordReset(email);
  assert.ok(resetCapture?.token);
  const reset = await call("/api/v1/auth/reset-password", {
    body: { token: resetCapture.token, newPassword: resetPassword },
  });
  assert.equal(reset.status, 200);
  const [[afterReset]] = await database.execute(
    "SELECT mfa_enabled, mfa_secret_ciphertext FROM users WHERE id = ?",
    [userId],
  );
  assert.equal(afterReset.mfa_enabled, 1);
  assert.ok(afterReset.mfa_secret_ciphertext);
  assert.equal((await login(originalPassword)).status, 401);

  const disabledChallenge = await login(resetPassword);
  await database.execute(
    "UPDATE users SET status = 'disabled', disabled_at = UTC_TIMESTAMP() WHERE id = ?",
    [userId],
  );
  assert.equal(
    (await verify(disabledChallenge.data.challengeToken, recoveryCodes[1])).status,
    401,
  );
  await database.execute(
    "UPDATE users SET status = 'active', disabled_at = NULL WHERE id = ?",
    [userId],
  );

  const disableSessionChallenge = await login(resetPassword);
  const disableSession = await verify(disableSessionChallenge.data.challengeToken, recoveryCodes[1]);
  assert.equal(disableSession.status, 200);
  rememberSession(disableSession);
  const disabledMfa = await call("/api/v1/auth/mfa/disable", {
    token: disableSession.data.accessToken,
    cookie: disableSession.cookie,
    origin: frontendOrigin,
    body: { currentPassword: resetPassword, code: recoveryCodes[2] },
  });
  assert.equal(disabledMfa.status, 200);
  const accessAfterDisable = await request(app)
    .get("/api/v1/auth/me")
    .set("Authorization", `Bearer ${disableSession.data.accessToken}`);
  assert.equal(accessAfterDisable.status, 401);
  const [[disabledMfaRow]] = await database.execute(
    "SELECT mfa_enabled, mfa_secret_ciphertext FROM users WHERE id = ?",
    [userId],
  );
  assert.equal(disabledMfaRow.mfa_enabled, 0);
  assert.equal(disabledMfaRow.mfa_secret_ciphertext, null);
  const normalLoginAfterDisable = await login(resetPassword);
  assert.equal(normalLoginAfterDisable.status, 200);
  rememberSession(normalLoginAfterDisable);

  console.log(
    "MFA integration checks passed: encrypted TOTP, deferred sessions, challenge caps, replay prevention, one-time recovery, reset preservation, disabled-user rejection, and disable revocation.",
  );
} finally {
  await database.execute("DELETE FROM auth_mfa_challenges WHERE user_id = ?", [userId]);
  await database.execute("DELETE FROM auth_mfa_recovery_codes WHERE user_id = ?", [userId]);
  await database.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);
  for (const sessionId of createdSessionIds) {
    await database.execute("DELETE FROM auth_sessions WHERE id = ?", [sessionId]);
  }
  for (const session of originalSessions) {
    await database.execute("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?", [
      session.revoked_at,
      session.id,
    ]);
  }
  await database.execute(
    `UPDATE users
     SET password = ?, password_changed_at = ?, status = ?, disabled_at = ?,
         failed_login_attempts = ?, locked_until = ?, last_login = ?, mfa_enabled = ?,
         mfa_secret_ciphertext = ?, mfa_secret_iv = ?, mfa_secret_tag = ?,
         mfa_enabled_at = ?, mfa_last_used_step = ?
     WHERE id = ?`,
    [
      originalUser.password,
      originalUser.password_changed_at,
      originalUser.status,
      originalUser.disabled_at,
      originalUser.failed_login_attempts,
      originalUser.locked_until,
      originalUser.last_login,
      originalUser.mfa_enabled,
      originalUser.mfa_secret_ciphertext,
      originalUser.mfa_secret_iv,
      originalUser.mfa_secret_tag,
      originalUser.mfa_enabled_at,
      originalUser.mfa_last_used_step,
      userId,
    ],
  );
  for (const row of originalChallenges) {
    await database.execute(
      `INSERT INTO auth_mfa_challenges
         (id, user_id, token_hash, attempts, max_attempts, expires_at, used_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.user_id, row.token_hash, row.attempts, row.max_attempts, row.expires_at, row.used_at, row.created_at],
    );
  }
  for (const row of originalRecoveryCodes) {
    await database.execute(
      `INSERT INTO auth_mfa_recovery_codes
         (id, user_id, code_hash, created_at, used_at)
       VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.user_id, row.code_hash, row.created_at, row.used_at],
    );
  }
  for (const row of originalPasswordResetTokens) {
    await database.execute(
      `INSERT INTO password_reset_tokens
         (id, user_id, token_hash, created_at, expires_at, used_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.user_id, row.token_hash, row.created_at, row.expires_at, row.used_at],
    );
  }
  await database.end();
  await pool.end();
}
