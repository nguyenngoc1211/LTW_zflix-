import assert from "node:assert/strict";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const baseUrl = process.env.API_URL || "http://localhost:3000";
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const call = async (path, { token, cookie, origin, ...options } = {}) => {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (cookie) headers.set("Cookie", cookie);
  if (origin) headers.set("Origin", origin);

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

const blockedOrigin = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: user.cookie,
  origin: "http://localhost:9999",
});
assert.equal(blockedOrigin.status, 403);

const refreshed = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: user.cookie,
  origin: frontendOrigin,
});
assert.equal(refreshed.status, 200);
assert.notEqual(refreshed.cookie, user.cookie);

const replayedRefresh = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: user.cookie,
  origin: frontendOrigin,
});
assert.equal(replayedRefresh.status, 401);

const logout = await call("/api/v1/auth/logout", {
  method: "POST",
  token: refreshed.data.accessToken,
  cookie: refreshed.cookie,
  origin: frontendOrigin,
});
assert.equal(logout.status, 204);

const revokedAccess = await call("/api/v1/auth/me", { token: refreshed.data.accessToken });
assert.equal(revokedAccess.status, 401);

const revokedRefresh = await call("/api/v1/auth/refresh-token", {
  method: "POST",
  cookie: refreshed.cookie,
  origin: frontendOrigin,
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
  origin: frontendOrigin,
});
assert.equal(expiredSessionRefresh.status, 401);

console.log(
  "Auth integration checks passed: validation, invalid login, admin/user roles, token/session expiry, origin protection, refresh rotation, and logout revocation.",
);
