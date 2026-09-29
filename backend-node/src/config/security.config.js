import "dotenv/config";
import crypto from "node:crypto";

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET?.trim();

if (!jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET is required");
}

const insecureProductionSecret =
  jwtAccessSecret.length < 32 ||
  /(change[-_ ]?me|replace[-_ ]?with|local[-_ ]?development|demo|example|test[-_ ]?only)/i.test(
    jwtAccessSecret,
  );

if (isProduction && insecureProductionSecret) {
  throw new Error("JWT_ACCESS_SECRET must be a strong, non-demo value in production");
}

const configuredOrigin = process.env.FRONTEND_ORIGIN?.trim();
if (isProduction && !configuredOrigin) {
  throw new Error("FRONTEND_ORIGIN is required in production");
}

const originUrl = new URL(configuredOrigin || "http://localhost:5173");
if (!["http:", "https:"].includes(originUrl.protocol)) {
  throw new Error("FRONTEND_ORIGIN must use http or https");
}

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const configuredMfaEncryptionKey = process.env.MFA_ENCRYPTION_KEY?.trim();
if (isProduction && !configuredMfaEncryptionKey) {
  throw new Error("MFA_ENCRYPTION_KEY is required in production");
}

const decodeMfaEncryptionKey = (value) => {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/u, "") !== value.replace(/=+$/u, "")) {
    throw new Error("MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
};

const mfaEncryptionKey = configuredMfaEncryptionKey
  ? decodeMfaEncryptionKey(configuredMfaEncryptionKey)
  : crypto.createHash("sha256").update(`development-mfa:${jwtAccessSecret}`).digest();

export const securityConfig = Object.freeze({
  isProduction,
  jwtAccessSecret,
  jwtAlgorithms: Object.freeze(["HS256"]),
  frontendOrigin: originUrl.origin,
  loginRateLimit: Object.freeze({
    windowMs: positiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: positiveInteger(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  }),
  refreshRateLimit: Object.freeze({
    windowMs: positiveInteger(process.env.REFRESH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: positiveInteger(process.env.REFRESH_RATE_LIMIT_MAX, 120),
  }),
  forgotPasswordRateLimit: Object.freeze({
    windowMs: positiveInteger(process.env.FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: positiveInteger(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX, 5),
  }),
  resetPasswordRateLimit: Object.freeze({
    windowMs: positiveInteger(process.env.RESET_PASSWORD_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: positiveInteger(process.env.RESET_PASSWORD_RATE_LIMIT_MAX, 10),
  }),
  accountLock: Object.freeze({
    maxFailedAttempts: positiveInteger(process.env.AUTH_MAX_FAILED_ATTEMPTS, 5),
    minutes: positiveInteger(process.env.AUTH_LOCK_MINUTES, 5),
  }),
  refreshSession: Object.freeze({
    idleTtlDays: positiveInteger(
      process.env.REFRESH_IDLE_TTL_DAYS ?? process.env.REFRESH_TOKEN_DAYS,
      7,
    ),
    absoluteTtlDays: positiveInteger(process.env.REFRESH_ABSOLUTE_TTL_DAYS, 30),
  }),
  passwordReset: Object.freeze({
    tokenTtlMinutes: positiveInteger(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 30),
  }),
  cleanup: Object.freeze({
    sessionRetentionDays: positiveInteger(process.env.AUTH_SESSION_RETENTION_DAYS, 30),
    passwordResetRetentionDays: positiveInteger(
      process.env.PASSWORD_RESET_RETENTION_DAYS,
      7,
    ),
    mfaChallengeRetentionDays: positiveInteger(
      process.env.MFA_CHALLENGE_RETENTION_DAYS,
      1,
    ),
    usedRecoveryCodeRetentionDays: positiveInteger(
      process.env.USED_RECOVERY_CODE_RETENTION_DAYS,
      30,
    ),
  }),
  mfa: Object.freeze({
    encryptionKey: mfaEncryptionKey,
    issuer: process.env.MFA_ISSUER?.trim() || "MovieHub",
    challengeTtlSeconds: positiveInteger(process.env.MFA_CHALLENGE_TTL_SECONDS, 5 * 60),
    challengeMaxAttempts: positiveInteger(process.env.MFA_CHALLENGE_MAX_ATTEMPTS, 5),
    verificationWindow: 1,
    recoveryCodeCount: 10,
    rateLimit: Object.freeze({
      windowMs: positiveInteger(process.env.MFA_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
      max: positiveInteger(process.env.MFA_RATE_LIMIT_MAX, 20),
    }),
  }),
});
