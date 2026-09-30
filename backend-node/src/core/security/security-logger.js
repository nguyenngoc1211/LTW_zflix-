const allowedEvents = new Set([
  "ACCESS_DENIED",
  "ACCOUNT_DISABLED_LOGIN_ATTEMPT",
  "ACCOUNT_LOCKED",
  "ADMIN_ACCESS_DENIED",
  "LOGIN_FAILED",
  "LOGIN_SUCCESS",
  "LOGOUT",
  "LOGOUT_ALL",
  "LOGOUT_OTHERS",
  "MFA_DISABLED",
  "MFA_ENABLED",
  "MFA_LOGIN_SUCCESS",
  "MFA_RECOVERY_REGENERATED",
  "MFA_RECOVERY_USED",
  "MFA_SETUP_STARTED",
  "MFA_VERIFY_FAILED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_FAILED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_SUCCESS",
  "REFRESH_FAILED",
  "REFRESH_SUCCESS",
  "REGISTER_FAILED",
  "REGISTER_SUCCESS",
  "SESSION_REVOKED",
  "SESSION_REVOKE_FAILED",
]);

const defaultSink = (line) => console.info(line);
let sink = defaultSink;

const safeString = (value, maxLength) =>
  typeof value === "string" && value.length > 0 ? value.slice(0, maxLength) : undefined;

const safeInteger = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
};

export const securityLog = (event, metadata = {}) => {
  if (!allowedEvents.has(event)) return;
  const record = {
    event,
    timestamp: new Date().toISOString(),
  };

  const userId = safeInteger(metadata.userId);
  const revokedCount = safeInteger(metadata.revokedCount);
  const sessionId = safeString(metadata.sessionId, 64);
  const targetSessionId = safeString(metadata.targetSessionId, 64);
  const ip = safeString(metadata.ip, 45);
  const userAgent = safeString(metadata.userAgent, 255);
  const reason = safeString(metadata.reason, 64);
  const factor = safeString(metadata.factor, 16);

  if (userId !== undefined) record.userId = userId;
  if (sessionId !== undefined) record.sessionId = sessionId;
  if (targetSessionId !== undefined) record.targetSessionId = targetSessionId;
  if (ip !== undefined) record.ip = ip;
  if (userAgent !== undefined) record.userAgent = userAgent;
  if (reason !== undefined) record.reason = reason;
  if (factor !== undefined) record.factor = factor;
  if (revokedCount !== undefined) record.revokedCount = revokedCount;

  try {
    sink(JSON.stringify(record));
  } catch {
    // Authentication behavior must not depend on log transport availability.
  }
};

export const setSecurityLogSinkForTests = (testSink) => {
  sink = typeof testSink === "function" ? testSink : defaultSink;
};
