import assert from "node:assert/strict";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import request from "supertest";

dotenv.config({ path: new URL("../../.env", import.meta.url) });
process.env.LOGIN_RATE_LIMIT_MAX = "1000";
process.env.REFRESH_RATE_LIMIT_MAX = "1000";

const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/core/database/pool.js");
const database = await mysql.createConnection({
  uri:
    process.env.DATABASE_URL ||
    "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db",
  timezone: "Z",
});

const testUserIds = [1, 2, 3, 4];
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

const login = (email, password) =>
  call("/api/v1/auth/login", { method: "post", body: { email, password } });

const rememberSession = (loginResult) => {
  const sessionId = jwt.decode(loginResult.data.accessToken)?.sid;
  assert.ok(sessionId);
  createdSessionIds.add(sessionId);
  return sessionId;
};

const adminEndpoints = (app.router?.stack || []).flatMap((layer) => {
  if (!layer.route) return [];
  const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
  return paths.flatMap((path) =>
    path.startsWith("/api/v1/admin/")
      ? Object.entries(layer.route.methods)
          .filter(([, enabled]) => enabled)
          .map(([method]) => ({ method, path }))
      : [],
  );
});

assert.ok(adminEndpoints.length > 0, "at least one /api/v1/admin/ endpoint must be covered");

const [originalUsers] = await database.query(
  `SELECT id, status, disabled_at, failed_login_attempts, locked_until, last_login
   FROM users WHERE id IN (?)`,
  [testUserIds],
);
const [originalSessions] = await database.query(
  `SELECT id, revoked_at FROM auth_sessions WHERE user_id IN (?)`,
  [testUserIds],
);

try {
  const invalidPayload = await call("/api/v1/auth/login", {
    method: "post",
    body: { email: "not-an-email", password: "abc123" },
  });
  assert.equal(invalidPayload.status, 400);

  await database.execute(
    `UPDATE users
     SET status = 'active', disabled_at = NULL, failed_login_attempts = 0, locked_until = NULL
     WHERE id = 4`,
  );
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const failed = await login("michael.b@email.com", "wrong-password");
    assert.equal(failed.status, 401, `failed login ${attempt} should return 401`);
  }

  const lockingAttempt = await login("michael.b@email.com", "wrong-password");
  assert.equal(lockingAttempt.status, 429);
  const [[lockedUser]] = await database.execute(
    "SELECT failed_login_attempts, locked_until FROM users WHERE id = 4",
  );
  assert.equal(lockedUser.failed_login_attempts, 5);
  assert.ok(new Date(lockedUser.locked_until).getTime() > Date.now());

  const correctWhileLocked = await login("michael.b@email.com", "abc123");
  assert.equal(correctWhileLocked.status, 429);

  await database.execute(
    "UPDATE users SET locked_until = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE id = 4",
  );
  const afterLock = await login("michael.b@email.com", "abc123");
  assert.equal(afterLock.status, 200);
  rememberSession(afterLock);
  const [[resetUser]] = await database.execute(
    "SELECT failed_login_attempts, locked_until FROM users WHERE id = 4",
  );
  assert.equal(resetUser.failed_login_attempts, 0);
  assert.equal(resetUser.locked_until, null);

  await database.execute(
    "UPDATE users SET status = 'disabled', disabled_at = UTC_TIMESTAMP() WHERE id = 3",
  );
  const disabledLogin = await login("jane.smith@email.com", "abc123");
  assert.equal(disabledLogin.status, 401);

  await database.execute(
    "UPDATE users SET status = 'active', disabled_at = NULL WHERE id = 3",
  );
  const statusSession = await login("jane.smith@email.com", "abc123");
  assert.equal(statusSession.status, 200);
  const statusSessionId = rememberSession(statusSession);
  const activeAccess = await call("/api/v1/auth/me", {
    token: statusSession.data.accessToken,
  });
  assert.equal(activeAccess.status, 200);

  await database.execute(
    "UPDATE users SET status = 'disabled', disabled_at = UTC_TIMESTAMP() WHERE id = 3",
  );
  const disabledAccess = await call("/api/v1/auth/me", {
    token: statusSession.data.accessToken,
  });
  assert.equal(disabledAccess.status, 401);
  const disabledLogoutAll = await call("/api/v1/auth/logout-all", {
    method: "post",
    token: statusSession.data.accessToken,
    cookie: statusSession.cookie,
    origin: frontendOrigin,
  });
  assert.equal(disabledLogoutAll.status, 401);
  const disabledAdminAccess = await call("/api/v1/admin/check", {
    token: statusSession.data.accessToken,
  });
  assert.equal(disabledAdminAccess.status, 401);
  const disabledRefresh = await call("/api/v1/auth/refresh-token", {
    method: "post",
    cookie: statusSession.cookie,
    origin: frontendOrigin,
  });
  assert.equal(disabledRefresh.status, 401);
  const [[disabledSession]] = await database.execute(
    "SELECT revoked_at FROM auth_sessions WHERE id = ?",
    [statusSessionId],
  );
  assert.ok(disabledSession.revoked_at);
  await database.execute(
    "UPDATE users SET status = 'active', disabled_at = NULL WHERE id = 3",
  );

  const idleSession = await login("jane.smith@email.com", "abc123");
  assert.equal(idleSession.status, 200);
  const idleSessionId = rememberSession(idleSession);
  await database.execute(
    "UPDATE auth_sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE id = ?",
    [idleSessionId],
  );
  const idleExpiredAccess = await call("/api/v1/auth/me", {
    token: idleSession.data.accessToken,
  });
  assert.equal(idleExpiredAccess.status, 401);
  const idleExpiredRefresh = await call("/api/v1/auth/refresh-token", {
    method: "post",
    cookie: idleSession.cookie,
    origin: frontendOrigin,
  });
  assert.equal(idleExpiredRefresh.status, 401);

  const absoluteSession = await login("jane.smith@email.com", "abc123");
  assert.equal(absoluteSession.status, 200);
  const absoluteSessionId = rememberSession(absoluteSession);
  await database.execute(
    `UPDATE auth_sessions
     SET expires_at = UTC_TIMESTAMP() + INTERVAL 1 DAY,
         absolute_expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND
     WHERE id = ?`,
    [absoluteSessionId],
  );
  const absoluteExpiredAccess = await call("/api/v1/auth/me", {
    token: absoluteSession.data.accessToken,
  });
  assert.equal(absoluteExpiredAccess.status, 401);
  const absoluteExpiredRefresh = await call("/api/v1/auth/refresh-token", {
    method: "post",
    cookie: absoluteSession.cookie,
    origin: frontendOrigin,
  });
  assert.equal(absoluteExpiredRefresh.status, 401);
  const [[revokedAbsoluteSession]] = await database.execute(
    "SELECT revoked_at FROM auth_sessions WHERE id = ?",
    [absoluteSessionId],
  );
  assert.ok(revokedAbsoluteSession.revoked_at);

  const cappedSession = await login("jane.smith@email.com", "abc123");
  assert.equal(cappedSession.status, 200);
  const cappedSessionId = rememberSession(cappedSession);
  await database.execute(
    `UPDATE auth_sessions
     SET expires_at = UTC_TIMESTAMP() + INTERVAL 1 HOUR,
         absolute_expires_at = UTC_TIMESTAMP() + INTERVAL 1 DAY
     WHERE id = ?`,
    [cappedSessionId],
  );
  const refreshed = await call("/api/v1/auth/refresh-token", {
    method: "post",
    cookie: cappedSession.cookie,
    origin: frontendOrigin,
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.cookie, cappedSession.cookie);
  const [[cappedDates]] = await database.execute(
    "SELECT expires_at, absolute_expires_at FROM auth_sessions WHERE id = ?",
    [cappedSessionId],
  );
  assert.equal(cappedDates.expires_at.getTime(), cappedDates.absolute_expires_at.getTime());
  const replayedRefresh = await call("/api/v1/auth/refresh-token", {
    method: "post",
    cookie: cappedSession.cookie,
    origin: frontendOrigin,
  });
  assert.equal(replayedRefresh.status, 401);

  const originSession = await login("jane.smith@email.com", "abc123");
  assert.equal(originSession.status, 200);
  rememberSession(originSession);
  const blockedOrigin = await call("/api/v1/auth/refresh-token", {
    method: "post",
    cookie: originSession.cookie,
    origin: "http://localhost:9999",
  });
  assert.equal(blockedOrigin.status, 403);

  const logoutSession = await login("jane.smith@email.com", "abc123");
  assert.equal(logoutSession.status, 200);
  rememberSession(logoutSession);
  const logout = await call("/api/v1/auth/logout", {
    method: "post",
    token: logoutSession.data.accessToken,
    cookie: logoutSession.cookie,
    origin: frontendOrigin,
  });
  assert.equal(logout.status, 204);
  assert.equal(
    (await call("/api/v1/auth/me", { token: logoutSession.data.accessToken })).status,
    401,
  );
  assert.equal(
    (
      await call("/api/v1/auth/refresh-token", {
        method: "post",
        cookie: logoutSession.cookie,
        origin: frontendOrigin,
      })
    ).status,
    401,
  );

  const deviceA = await login("michael.b@email.com", "abc123");
  const deviceB = await login("michael.b@email.com", "abc123");
  assert.equal(deviceA.status, 200);
  assert.equal(deviceB.status, 200);
  rememberSession(deviceA);
  rememberSession(deviceB);
  const logoutAll = await call("/api/v1/auth/logout-all", {
    method: "post",
    token: deviceA.data.accessToken,
    cookie: deviceA.cookie,
    origin: frontendOrigin,
  });
  assert.equal(logoutAll.status, 204);
  assert.equal(
    (await call("/api/v1/auth/me", { token: deviceA.data.accessToken })).status,
    401,
  );
  assert.equal(
    (await call("/api/v1/auth/me", { token: deviceB.data.accessToken })).status,
    401,
  );
  assert.equal(
    (
      await call("/api/v1/auth/refresh-token", {
        method: "post",
        cookie: deviceA.cookie,
        origin: frontendOrigin,
      })
    ).status,
    401,
  );
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

  const regularUser = await login("john.doe@email.com", "abc123");
  assert.equal(regularUser.status, 200);
  rememberSession(regularUser);
  const admin = await login("admin@moviehub.com", "abc123");
  assert.equal(admin.status, 200);
  rememberSession(admin);

  for (const endpoint of adminEndpoints) {
    const guestAdmin = await call(endpoint.path, { method: endpoint.method });
    assert.equal(guestAdmin.status, 401, `guest ${endpoint.method} ${endpoint.path}`);

    const userAdmin = await call(endpoint.path, {
      method: endpoint.method,
      token: regularUser.data.accessToken,
    });
    assert.equal(userAdmin.status, 403, `user ${endpoint.method} ${endpoint.path}`);

    const adminAdmin = await call(endpoint.path, {
      method: endpoint.method,
      token: admin.data.accessToken,
    });
    assert.ok(
      adminAdmin.status >= 200 && adminAdmin.status < 300,
      `admin ${endpoint.method} ${endpoint.path}`,
    );
  }

  const regularPayload = jwt.decode(regularUser.data.accessToken);
  const forgedAdminRoleToken = jwt.sign(
    { role: "admin", sid: regularPayload.sid },
    process.env.JWT_ACCESS_SECRET,
    {
      subject: String(regularUser.data.user.id),
      expiresIn: "5m",
      algorithm: "HS256",
    },
  );
  const forgedRoleAdmin = await call("/api/v1/admin/check", {
    token: forgedAdminRoleToken,
  });
  assert.equal(forgedRoleAdmin.status, 403);

  console.log(
    `Auth integration checks passed: JWT role forgery rejected, disabled sessions rejected, ${adminEndpoints.length} admin endpoint(s) covered, and full auth regression passed.`,
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
  for (const user of originalUsers) {
    await database.execute(
      `UPDATE users
       SET status = ?, disabled_at = ?, failed_login_attempts = ?, locked_until = ?, last_login = ?
       WHERE id = ?`,
      [
        user.status,
        user.disabled_at,
        user.failed_login_attempts,
        user.locked_until,
        user.last_login,
        user.id,
      ],
    );
  }
  await database.end();
  await pool.end();
}
