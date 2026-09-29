import assert from "node:assert/strict";
import crypto from "node:crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import request from "supertest";

dotenv.config({ path: new URL("../../.env", import.meta.url) });
process.env.LOGIN_RATE_LIMIT_MAX = "1000";
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

const localUser = { id: 5, email: "sarah.j@email.com" };
const nonLocalEmail = "david.w@email.com";
const originalPassword = "abc123";
const changedPassword = "Phase3-Changed-Password";
const resetPasswordValue = "Phase3-Reset-Password";
const concurrentPassword = "Phase3-Concurrent-Password";
const genericForgotMessage =
  "If the email exists, password reset instructions have been sent";
const createdSessionIds = new Set();

const call = async (path, { method = "get", token, cookie, origin, body } = {}) => {
  let pending = request(app)[method](path);
  if (token) pending = pending.set("Authorization", `Bearer ${token}`);
  if (cookie) pending = pending.set("Cookie", cookie);
  if (origin) pending = pending.set("Origin", origin);
  if (body !== undefined) pending = pending.send(body);

  const response = await pending;
  const refreshCookie = response.headers["set-cookie"]
    ?.map((value) => value.split(";")[0])
    .find((value) => value.startsWith("refreshToken="));
  return { status: response.status, data: response.body, cookie: refreshCookie };
};

const login = (password) =>
  call("/api/v1/auth/login", {
    method: "post",
    body: { email: localUser.email, password },
  });

const rememberSession = (loginResult) => {
  const sessionId = jwt.decode(loginResult.data.accessToken)?.sid;
  assert.ok(sessionId);
  createdSessionIds.add(sessionId);
  return sessionId;
};

const forgotPassword = (email) =>
  call("/api/v1/auth/forgot-password", { method: "post", body: { email } });

const resetWith = (token, newPassword) =>
  call("/api/v1/auth/reset-password", {
    method: "post",
    body: { token, newPassword },
  });

const captureToken = () => {
  const capture = consumeDevelopmentPasswordReset(localUser.email);
  assert.ok(capture?.token);
  assert.equal(capture.resetUrl.includes(encodeURIComponent(capture.token)), true);
  return capture.token;
};

const [[originalUser]] = await database.execute(
  `SELECT password, password_changed_at, status, disabled_at,
          failed_login_attempts, locked_until, last_login
   FROM users WHERE id = ?`,
  [localUser.id],
);
const [originalSessions] = await database.execute(
  "SELECT id, revoked_at FROM auth_sessions WHERE user_id = ?",
  [localUser.id],
);
const [originalResetTokens] = await database.execute(
  `SELECT id, user_id, token_hash, created_at, expires_at, used_at
   FROM password_reset_tokens WHERE user_id = ?`,
  [localUser.id],
);

try {
  await database.execute(
    `UPDATE users
     SET status = 'active', disabled_at = NULL,
         failed_login_attempts = 0, locked_until = NULL
     WHERE id = ?`,
    [localUser.id],
  );
  await database.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [localUser.id]);

  const guestChange = await call("/api/v1/auth/change-password", {
    method: "post",
    origin: frontendOrigin,
    body: { currentPassword: originalPassword, newPassword: changedPassword },
  });
  assert.equal(guestChange.status, 401);

  const deviceA = await login(originalPassword);
  const deviceB = await login(originalPassword);
  assert.equal(deviceA.status, 200);
  assert.equal(deviceB.status, 200);
  rememberSession(deviceA);
  rememberSession(deviceB);

  const shortChange = await call("/api/v1/auth/change-password", {
    method: "post",
    token: deviceA.data.accessToken,
    origin: frontendOrigin,
    body: { currentPassword: originalPassword, newPassword: "short" },
  });
  assert.equal(shortChange.status, 400);
  const longChange = await call("/api/v1/auth/change-password", {
    method: "post",
    token: deviceA.data.accessToken,
    origin: frontendOrigin,
    body: { currentPassword: originalPassword, newPassword: "x".repeat(129) },
  });
  assert.equal(longChange.status, 400);
  const wrongCurrent = await call("/api/v1/auth/change-password", {
    method: "post",
    token: deviceA.data.accessToken,
    origin: frontendOrigin,
    body: { currentPassword: "wrong-password", newPassword: changedPassword },
  });
  assert.equal(wrongCurrent.status, 400);

  const changed = await call("/api/v1/auth/change-password", {
    method: "post",
    token: deviceA.data.accessToken,
    cookie: deviceA.cookie,
    origin: frontendOrigin,
    body: { currentPassword: originalPassword, newPassword: changedPassword },
  });
  assert.equal(changed.status, 200);
  assert.equal((await call("/api/v1/auth/me", { token: deviceA.data.accessToken })).status, 401);
  assert.equal(
    (
      await call("/api/v1/auth/refresh-token", {
        method: "post",
        cookie: deviceB.cookie,
        origin: frontendOrigin,
      })
    ).status,
    401,
  );
  assert.equal((await login(originalPassword)).status, 401);

  const changedLogin = await login(changedPassword);
  assert.equal(changedLogin.status, 200);
  rememberSession(changedLogin);
  const samePassword = await call("/api/v1/auth/change-password", {
    method: "post",
    token: changedLogin.data.accessToken,
    origin: frontendOrigin,
    body: { currentPassword: changedPassword, newPassword: changedPassword },
  });
  assert.equal(samePassword.status, 400);

  const existingForgot = await forgotPassword(localUser.email.toUpperCase());
  assert.equal(existingForgot.status, 200);
  assert.deepEqual(existingForgot.data, { message: genericForgotMessage });
  assert.equal("token" in existingForgot.data, false);
  const tokenA = captureToken();
  const tokenAHash = crypto.createHash("sha256").update(tokenA).digest("hex");
  const [[storedTokenA]] = await database.execute(
    `SELECT token_hash, expires_at
     FROM password_reset_tokens
     WHERE user_id = ? AND used_at IS NULL`,
    [localUser.id],
  );
  assert.equal(storedTokenA.token_hash, tokenAHash);
  assert.notEqual(storedTokenA.token_hash, tokenA);
  assert.ok(storedTokenA.expires_at.getTime() > Date.now());

  const unknownForgot = await forgotPassword("unknown-user@example.test");
  assert.equal(unknownForgot.status, existingForgot.status);
  assert.deepEqual(unknownForgot.data, existingForgot.data);
  const nonLocalForgot = await forgotPassword(nonLocalEmail);
  assert.equal(nonLocalForgot.status, existingForgot.status);
  assert.deepEqual(nonLocalForgot.data, existingForgot.data);
  const invalidForgot = await forgotPassword("not-an-email");
  assert.equal(invalidForgot.status, 400);

  const secondForgot = await forgotPassword(localUser.email);
  assert.equal(secondForgot.status, 200);
  const tokenB = captureToken();
  assert.notEqual(tokenA, tokenB);
  assert.equal((await resetWith(tokenA, resetPasswordValue)).status, 400);

  const resetDeviceB = await login(changedPassword);
  assert.equal(resetDeviceB.status, 200);
  rememberSession(resetDeviceB);
  const validReset = await resetWith(tokenB, resetPasswordValue);
  assert.equal(validReset.status, 200);
  assert.equal((await resetWith(tokenB, "Phase3-Reused-Password")).status, 400);
  assert.equal(
    (await call("/api/v1/auth/me", { token: changedLogin.data.accessToken })).status,
    401,
  );
  assert.equal(
    (
      await call("/api/v1/auth/refresh-token", {
        method: "post",
        cookie: resetDeviceB.cookie,
        origin: frontendOrigin,
      })
    ).status,
    401,
  );
  assert.equal((await login(changedPassword)).status, 401);
  const resetLogin = await login(resetPasswordValue);
  assert.equal(resetLogin.status, 200);
  rememberSession(resetLogin);

  await forgotPassword(localUser.email);
  const expiredToken = captureToken();
  const expiredHash = crypto.createHash("sha256").update(expiredToken).digest("hex");
  await database.execute(
    `UPDATE password_reset_tokens
     SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND
     WHERE token_hash = ?`,
    [expiredHash],
  );
  assert.equal((await resetWith(expiredToken, concurrentPassword)).status, 400);
  assert.equal((await resetWith(crypto.randomBytes(32).toString("base64url"), concurrentPassword)).status, 400);
  assert.equal((await resetWith("", concurrentPassword)).status, 400);

  await forgotPassword(localUser.email);
  const concurrentToken = captureToken();
  assert.equal((await resetWith(concurrentToken, "short")).status, 400);
  const concurrentResults = await Promise.all([
    resetWith(concurrentToken, concurrentPassword),
    resetWith(concurrentToken, concurrentPassword),
  ]);
  assert.deepEqual(
    concurrentResults.map((result) => result.status).sort(),
    [200, 400],
  );
  assert.equal((await call("/api/v1/auth/me", { token: resetLogin.data.accessToken })).status, 401);
  assert.equal((await login(resetPasswordValue)).status, 401);
  const concurrentLogin = await login(concurrentPassword);
  assert.equal(concurrentLogin.status, 200);
  rememberSession(concurrentLogin);

  console.log(
    "Password lifecycle checks passed: change, generic forgot, hashed/expiring one-time reset, token replacement, concurrent use, and session revocation.",
  );
} finally {
  for (const sessionId of createdSessionIds) {
    await database.execute("DELETE FROM auth_sessions WHERE id = ?", [sessionId]);
  }
  for (const session of originalSessions) {
    await database.execute("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?", [
      session.revoked_at,
      session.id,
    ]);
  }
  await database.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [localUser.id]);
  for (const token of originalResetTokens) {
    await database.execute(
      `INSERT INTO password_reset_tokens
         (id, user_id, token_hash, created_at, expires_at, used_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [token.id, token.user_id, token.token_hash, token.created_at, token.expires_at, token.used_at],
    );
  }
  await database.execute(
    `UPDATE users
     SET password = ?, password_changed_at = ?, status = ?, disabled_at = ?,
         failed_login_attempts = ?, locked_until = ?, last_login = ?
     WHERE id = ?`,
    [
      originalUser.password,
      originalUser.password_changed_at,
      originalUser.status,
      originalUser.disabled_at,
      originalUser.failed_login_attempts,
      originalUser.locked_until,
      originalUser.last_login,
      localUser.id,
    ],
  );
  consumeDevelopmentPasswordReset(localUser.email);
  await database.end();
  await pool.end();
}
