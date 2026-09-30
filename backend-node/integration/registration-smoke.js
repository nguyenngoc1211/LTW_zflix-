import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import request from "supertest";

dotenv.config({ path: new URL("../../.env", import.meta.url) });
process.env.REGISTRATION_RATE_LIMIT_MAX = "1000";

const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/core/database/pool.js");
const { setSecurityLogSinkForTests } = await import("../src/core/security/security-logger.js");
const database = await mysql.createConnection({
  uri: process.env.DATABASE_URL || "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db",
  timezone: "Z",
});
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const suffix = crypto.randomBytes(6).toString("hex");
const username = `reg_${suffix}`;
const email = `reg_${suffix}@example.test`;
const password = "local-registration-test-password";
const logs = [];
let createdUserId;

setSecurityLogSinkForTests((line) => logs.push(JSON.parse(line)));

try {
  const register = (body, requestOrigin = origin) => {
    const pending = request(app).post("/api/v1/auth/register");
    if (requestOrigin) pending.set("Origin", requestOrigin);
    return pending.send(body);
  };

  const missingOrigin = await register({ username, email, password }, null);
  assert.equal(missingOrigin.status, 403);

  const invalid = await register({ username: "x", email, password });
  assert.equal(invalid.status, 400);

  const truncatedByBcrypt = await register({ username, email, password: "a".repeat(73) });
  assert.equal(truncatedByBcrypt.status, 400);

  const created = await register({
    username,
    email: email.toUpperCase(),
    password,
    role: "admin",
    status: "disabled",
    provider: "google",
    vip_expires_at: "2099-01-01",
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { message: "Account created. Please sign in." });
  assert.equal(created.headers["set-cookie"], undefined);
  assert.equal(created.body.accessToken, undefined);

  const [rows] = await database.execute(
    `SELECT id, username, email, password, role, provider, status, vip_expires_at
     FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  assert.equal(rows.length, 1);
  const user = rows[0];
  createdUserId = user.id;
  assert.equal(user.username, username);
  assert.equal(user.email, email);
  assert.equal(user.role, "user");
  assert.equal(user.provider, "local");
  assert.equal(user.status, "active");
  assert.equal(user.vip_expires_at, null);
  assert.notEqual(user.password, password);
  assert.equal(await bcrypt.compare(password, user.password), true);

  const duplicateEmail = await register({
    username: `${username}_2`, email: email.toUpperCase(), password,
  });
  assert.equal(duplicateEmail.status, 409);
  const duplicateUsername = await register({
    username, email: `other_${suffix}@example.test`, password,
  });
  assert.equal(duplicateUsername.status, 409);

  const signedIn = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
  assert.equal(signedIn.status, 200);
  assert.equal(signedIn.body.user.role, "user");
  const deniedAdmin = await request(app)
    .get("/api/v1/admin/check")
    .set("Authorization", `Bearer ${signedIn.body.accessToken}`);
  assert.equal(deniedAdmin.status, 403);

  assert.ok(logs.some((entry) => entry.event === "REGISTER_SUCCESS" && entry.userId === user.id));
  assert.ok(logs.some((entry) => entry.event === "REGISTER_FAILED" && entry.reason === "duplicate_account"));
  assert.equal(logs.some((entry) => JSON.stringify(entry).includes(password)), false);
  console.log("Registration integration checks passed: validation, duplicates, fixed user role, bcrypt, login, and admin denial.");
} finally {
  setSecurityLogSinkForTests(null);
  if (createdUserId) await database.execute("DELETE FROM users WHERE id = ?", [createdUserId]);
  await database.end();
  await pool.end();
}
