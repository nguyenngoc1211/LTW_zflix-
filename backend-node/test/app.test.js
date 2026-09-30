import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.DATABASE_URL ||= "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db";
process.env.JWT_ACCESS_SECRET ||= "test-only-secret-with-at-least-thirty-two-characters";
process.env.FRONTEND_ORIGIN ||= "http://localhost:5173";
process.env.MFA_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString("base64");

const { default: app } = await import("../src/app.js");

test("health endpoint reports an operational API", async () => {
  const response = await request(app).get("/");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { message: "Movie Streaming Backend", status: "ok" });
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["content-security-policy"], undefined);
});

test("login rejects a missing email and password before querying the database", async () => {
  const response = await request(app).post("/api/v1/auth/login").send({});
  assert.equal(response.status, 400);
  assert.equal(response.body.message, "A valid email and password are required");
});

test("registration requires the configured origin and validates input", async () => {
  const missingOrigin = await request(app)
    .post("/api/v1/auth/register")
    .send({ username: "new_user", email: "new@example.test", password: "password-123" });
  assert.equal(missingOrigin.status, 403);

  const invalid = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", process.env.FRONTEND_ORIGIN)
    .send({ username: "x", email: "invalid", password: "short" });
  assert.equal(invalid.status, 400);

  const truncatedByBcrypt = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", process.env.FRONTEND_ORIGIN)
    .send({ username: "new_user", email: "new@example.test", password: "a".repeat(73) });
  assert.equal(truncatedByBcrypt.status, 400);
});

test("admin endpoint rejects requests without an access token", async () => {
  const response = await request(app).get("/api/v1/admin/check");
  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication required");
});

test("JWT verification rejects algorithms outside the allow-list", async () => {
  const token = jwt.sign(
    { role: "admin", sid: "test-session" },
    process.env.JWT_ACCESS_SECRET,
    { subject: "1", algorithm: "HS384", expiresIn: "5m" },
  );
  const response = await request(app)
    .get("/api/v1/admin/check")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Access token is invalid or expired");
});

test("cookie-backed endpoints require the configured frontend origin", async () => {
  const missingOrigin = await request(app).post("/api/v1/auth/refresh-token");
  assert.equal(missingOrigin.status, 403);

  const wrongOrigin = await request(app)
    .post("/api/v1/auth/logout")
    .set("Origin", "http://localhost:9999");
  assert.equal(wrongOrigin.status, 403);

  const allowedOrigin = await request(app)
    .post("/api/v1/auth/refresh-token")
    .set("Origin", process.env.FRONTEND_ORIGIN);
  assert.equal(allowedOrigin.status, 401);

  const missingMfaOrigin = await request(app)
    .post("/api/v1/auth/mfa/verify")
    .send({ challengeToken: "challenge", code: "123456" });
  assert.equal(missingMfaOrigin.status, 403);
});

test("password lifecycle endpoints validate input and rate-limit forgot-password", async () => {
  const guestChange = await request(app)
    .post("/api/v1/auth/change-password")
    .set("Origin", process.env.FRONTEND_ORIGIN)
    .send({ currentPassword: "old-password", newPassword: "new-password" });
  assert.equal(guestChange.status, 401);

  let invalidForgot;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    invalidForgot = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "not-an-email" });
    assert.equal(invalidForgot.status, 400);
  }
  const limitedForgot = await request(app)
    .post("/api/v1/auth/forgot-password")
    .send({ email: "not-an-email" });
  assert.equal(limitedForgot.status, 429);

  const malformedReset = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: "", newPassword: "valid-password" });
  assert.equal(malformedReset.status, 400);

  const truncatedResetPassword = await request(app)
    .post("/api/v1/auth/reset-password")
    .send({ token: "test-token", newPassword: "a".repeat(73) });
  assert.equal(truncatedResetPassword.status, 400);
});

test("login rate limit returns 429 without account-specific information", async () => {
  let response;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    response = await request(app).post("/api/v1/auth/login").send({});
  }
  assert.equal(response.status, 429);
  assert.equal(
    response.body.message,
    "Too many authentication requests. Please try again later",
  );
  assert.ok(response.headers["ratelimit"]);
});

test("production rejects missing or weak JWT secrets without printing their values", () => {
  const weakSecret = "weak-secret-value";
  const productionEnv = {
    ...process.env,
    NODE_ENV: "production",
    FRONTEND_ORIGIN: "https://movies.example.com",
    MFA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString("base64"),
    DOTENV_CONFIG_PATH: "./test/does-not-exist.env",
  };
  delete productionEnv.JWT_ACCESS_SECRET;

  const missingResult = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", "import('./src/config/security.config.js')"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8", env: productionEnv },
  );
  assert.notEqual(missingResult.status, 0);
  assert.match(missingResult.stderr, /JWT_ACCESS_SECRET is required/);

  const weakResult = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", "import('./src/config/security.config.js')"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...productionEnv,
        JWT_ACCESS_SECRET: weakSecret,
      },
    },
  );
  assert.notEqual(weakResult.status, 0);
  assert.match(weakResult.stderr, /strong, non-demo value/);
  assert.equal(weakResult.stderr.includes(weakSecret), false);
});

test("production requires a dedicated 32-byte MFA encryption key", () => {
  const productionEnv = {
    ...process.env,
    NODE_ENV: "production",
    FRONTEND_ORIGIN: "https://movies.example.com",
    JWT_ACCESS_SECRET: "9f4d8a12c7e65b30a1f829d46c73e5089b2a61d4f7c83e50",
    DOTENV_CONFIG_PATH: "./test/does-not-exist.env",
  };
  delete productionEnv.MFA_ENCRYPTION_KEY;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", "import('./src/config/security.config.js')"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8", env: productionEnv },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MFA_ENCRYPTION_KEY is required in production/);
});

test("production password reset delivery is disabled when no provider is configured", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import('./src/modules/auth/password-reset-delivery.js').then((module) => {
        if (module.passwordResetDeliveryAvailable()) process.exit(2);
      })`,
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        FRONTEND_ORIGIN: "https://movies.example.com",
        JWT_ACCESS_SECRET: "9f4d8a12c7e65b30a1f829d46c73e5089b2a61d4f7c83e50",
        MFA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
        DOTENV_CONFIG_PATH: "./test/does-not-exist.env",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
});
