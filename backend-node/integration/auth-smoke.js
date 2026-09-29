import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";

const baseUrl = process.env.API_URL || "http://localhost:3000";

const call = async (path, { token, cookie, ...options } = {}) => {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  const setCookie = response.headers.get("set-cookie")?.split(";")[0] || null;
  return { status: response.status, data, cookie: setCookie };
};

const login = (email, password) =>
  call("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

const invalidPayload = await call("/api/v1/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "not-an-email", password: "abc123" }),
});
assert.equal(invalidPayload.status, 400);

const wrongPassword = await login("admin@moviehub.com", "wrong-password");
assert.equal(wrongPassword.status, 401);

const admin = await login("admin@moviehub.com", "abc123");
assert.equal(admin.status, 200);
assert.equal(admin.data.user.role, "admin");
assert.ok(admin.data.accessToken);
assert.ok(admin.cookie?.startsWith("refreshToken="));

const adminMe = await call("/api/v1/auth/me", { token: admin.data.accessToken });
assert.equal(adminMe.status, 200);
assert.equal(adminMe.data.user.email, "admin@moviehub.com");

const adminCheck = await call("/api/v1/admin/check", { token: admin.data.accessToken });
assert.equal(adminCheck.status, 200);

const adminPayload = jwt.decode(admin.data.accessToken);
const expiredAccessToken = jwt.sign(
  { role: "admin", sid: adminPayload.sid },
  process.env.JWT_ACCESS_SECRET || "local-development-secret-change-in-production",
  { subject: String(admin.data.user.id), expiresIn: -1 },
);
const expiredAccess = await call("/api/v1/auth/me", { token: expiredAccessToken });
assert.equal(expiredAccess.status, 401);

const user = await login("john.doe@email.com", "abc123");
assert.equal(user.status, 200);
assert.equal(user.data.user.role, "user");

const deniedAdmin = await call("/api/v1/admin/check", { token: user.data.accessToken });
assert.equal(deniedAdmin.status, 403);

const refreshed = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: user.cookie,
});
assert.equal(refreshed.status, 200);
assert.notEqual(refreshed.cookie, user.cookie);

const replayedRefresh = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: user.cookie,
});
assert.equal(replayedRefresh.status, 401);

const logout = await call("/api/v1/auth/logout", {
  method: "POST",
  token: refreshed.data.accessToken,
  cookie: refreshed.cookie,
});
assert.equal(logout.status, 204);

const revokedAccess = await call("/api/v1/auth/me", { token: refreshed.data.accessToken });
assert.equal(revokedAccess.status, 401);

const revokedRefresh = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: refreshed.cookie,
});
assert.equal(revokedRefresh.status, 401);

const expiringSession = await login("jane.smith@email.com", "abc123");
assert.equal(expiringSession.status, 200);
const expiringPayload = jwt.decode(expiringSession.data.accessToken);
const database = await mysql.createConnection(
  process.env.DATABASE_URL || "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db",
);
await database.execute(
  "UPDATE auth_sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE id = ?",
  [expiringPayload.sid],
);
await database.end();

const expiredSessionAccess = await call("/api/v1/auth/me", {
  token: expiringSession.data.accessToken,
});
assert.equal(expiredSessionAccess.status, 401);
const expiredSessionRefresh = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: expiringSession.cookie,
});
assert.equal(expiredSessionRefresh.status, 401);

console.log(
  "Auth integration checks passed: validation, invalid login, admin/user roles, token/session expiry, refresh rotation, and logout revocation.",
);
