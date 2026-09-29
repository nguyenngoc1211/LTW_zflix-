import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.DATABASE_URL ||= "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db";
process.env.JWT_ACCESS_SECRET ||= "test-only-secret-with-at-least-thirty-two-characters";
process.env.FRONTEND_ORIGIN ||= "http://localhost:5173";

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
