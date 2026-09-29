import assert from "node:assert/strict";
import test from "node:test";
import {
  securityLog,
  setSecurityLogSinkForTests,
} from "../src/core/security/security-logger.js";

test("security logger emits allow-listed JSON fields and drops secrets", () => {
  const lines = [];
  setSecurityLogSinkForTests((line) => lines.push(line));
  try {
    securityLog("LOGIN_FAILED", {
      userId: 2,
      sessionId: "safe-session",
      ip: "127.0.0.1",
      userAgent: "x".repeat(300),
      reason: "invalid_credentials",
      password: "never-log-password",
      accessToken: "never-log-access-token",
      refreshToken: "never-log-refresh-token",
      resetToken: "never-log-reset-token",
      totpCode: "123456",
      recoveryCode: "never-log-recovery-code",
      challengeToken: "never-log-challenge",
    });

    assert.equal(lines.length, 1);
    const record = JSON.parse(lines[0]);
    assert.equal(record.event, "LOGIN_FAILED");
    assert.equal(record.userId, 2);
    assert.equal(record.sessionId, "safe-session");
    assert.equal(record.userAgent.length, 255);
    assert.ok(Date.parse(record.timestamp));
    assert.deepEqual(Object.keys(record).sort(), [
      "event",
      "ip",
      "reason",
      "sessionId",
      "timestamp",
      "userAgent",
      "userId",
    ]);
    assert.doesNotMatch(
      lines[0],
      /never-log|password|accessToken|refreshToken|resetToken|totpCode|recoveryCode|challengeToken/iu,
    );

    securityLog("NOT_AN_ALLOWED_EVENT", { userId: 2 });
    assert.equal(lines.length, 1);

    setSecurityLogSinkForTests(() => {
      throw new Error("unavailable log transport");
    });
    assert.doesNotThrow(() => securityLog("LOGIN_SUCCESS", { userId: 2 }));
  } finally {
    setSecurityLogSinkForTests(null);
  }
});
