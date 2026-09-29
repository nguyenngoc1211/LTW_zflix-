import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_ACCESS_SECRET ||= "test-only-secret-with-at-least-thirty-two-characters";
process.env.FRONTEND_ORIGIN ||= "http://localhost:5173";
process.env.MFA_ENCRYPTION_KEY ||= Buffer.alloc(32, 11).toString("base64");

const {
  createRecoveryCodes,
  createTotpEnrollment,
  decryptTotpSecret,
  encryptTotpSecret,
  hashRecoveryCode,
  validateTotp,
} = await import("../src/modules/auth/mfa.js");
const OTPAuth = await import("otpauth");

test("TOTP enrollment encrypts its secret and validates RFC 6238 codes", () => {
  const enrollment = createTotpEnrollment("user@example.com");
  assert.match(enrollment.secret, /^[A-Z2-7]+$/u);
  assert.match(enrollment.otpauthUrl, /^otpauth:\/\/totp\//u);

  const encrypted = encryptTotpSecret(enrollment.secret);
  assert.equal(encrypted.iv.length, 12);
  assert.equal(encrypted.tag.length, 16);
  assert.notEqual(encrypted.ciphertext.toString("utf8"), enrollment.secret);
  assert.equal(decryptTotpSecret(encrypted), enrollment.secret);

  const totp = new OTPAuth.TOTP({
    issuer: "MovieHub",
    label: "user@example.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(enrollment.secret),
  });
  assert.equal(typeof validateTotp(enrollment.secret, totp.generate()), "number");
  assert.equal(validateTotp(enrollment.secret, "not-a-code"), null);
});

test("recovery codes have 128 bits of randomness and stable normalized hashes", () => {
  const codes = createRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) assert.match(code, /^(?:[A-F0-9]{8}-){3}[A-F0-9]{8}$/u);
  assert.equal(hashRecoveryCode(codes[0]), hashRecoveryCode(codes[0].replaceAll("-", "").toLowerCase()));
  assert.notEqual(hashRecoveryCode(codes[0]), codes[0]);
});
