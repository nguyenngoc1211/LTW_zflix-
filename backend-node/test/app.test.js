import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.DATABASE_URL ||= "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db";
process.env.JWT_ACCESS_SECRET ||= "test-only-secret";

const { default: app } = await import("../src/app.js");

test("health endpoint reports an operational API", async () => {
  const response = await request(app).get("/");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { message: "Movie Streaming Backend", status: "ok" });
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
