import crypto from "node:crypto";
import * as OTPAuth from "otpauth";
import { securityConfig } from "../../config/security.config.js";

const algorithm = "aes-256-gcm";
const totpPeriodSeconds = 30;

export const hashOpaqueToken = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const createMfaChallengeToken = () => crypto.randomBytes(32).toString("base64url");

export const createTotpEnrollment = (email) => {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: securityConfig.mfa.issuer,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: totpPeriodSeconds,
    secret,
  });
  return { secret: secret.base32, otpauthUrl: totp.toString() };
};

export const encryptTotpSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, securityConfig.mfa.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
};

export const decryptTotpSecret = ({ ciphertext, iv, tag }) => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    securityConfig.mfa.encryptionKey,
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
};

export const validateTotp = (secret, token, timestamp = Date.now()) => {
  if (typeof token !== "string" || !/^\d{6}$/u.test(token)) return null;
  const totp = new OTPAuth.TOTP({
    issuer: securityConfig.mfa.issuer,
    algorithm: "SHA1",
    digits: 6,
    period: totpPeriodSeconds,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({
    token,
    timestamp,
    window: securityConfig.mfa.verificationWindow,
  });
  if (delta === null) return null;
  return Math.floor(timestamp / (totpPeriodSeconds * 1000)) + delta;
};

const normalizeRecoveryCode = (code) =>
  typeof code === "string" ? code.replace(/[^a-zA-Z0-9]/gu, "").toUpperCase() : "";

export const hashRecoveryCode = (code) => {
  const normalized = normalizeRecoveryCode(code);
  return normalized ? hashOpaqueToken(normalized) : null;
};

export const createRecoveryCodes = () =>
  Array.from({ length: securityConfig.mfa.recoveryCodeCount }, () => {
    const compact = crypto.randomBytes(16).toString("hex").toUpperCase();
    return compact.match(/.{1,8}/gu).join("-");
  });
