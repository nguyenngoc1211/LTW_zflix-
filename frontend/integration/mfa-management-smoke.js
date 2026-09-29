import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const apiUrl = process.env.API_URL || "http://localhost:3000";
const executablePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const user = { id: 2, username: "john_doe", email: "john.doe@email.com", role: "user" };
const enrollmentCodes = Array.from({ length: 10 }, (_, index) => `ENROLL-${index + 1}`);
const regeneratedCodes = Array.from({ length: 10 }, (_, index) => `NEWCODE-${index + 1}`);

const browser = await chromium.launch({ executablePath, headless: true });

const installAuthenticatedMocks = async (page, initialEnabled) => {
  let enabled = initialEnabled;
  let revoked = false;
  let regenerationRequests = 0;
  let disableRequests = 0;

  await page.route(`${apiUrl}/api/v1/auth/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postDataJSON?.() || {};
    const json = (status, value) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

    if (path === "/api/v1/auth/refresh-token") {
      return revoked
        ? json(401, { message: "Refresh session is invalid or expired" })
        : json(200, { accessToken: "management-test-token", user });
    }
    if (path === "/api/v1/auth/mfa/status") {
      return json(200, {
        enabled,
        enabledAt: enabled ? "2026-09-29T00:00:00.000Z" : null,
        recoveryCodesRemaining: enabled ? 8 : 0,
      });
    }
    if (path === "/api/v1/auth/sessions") {
      return json(200, {
        sessions: [{
          id: "current-session",
          createdAt: "2026-09-29T00:00:00.000Z",
          lastUsedAt: null,
          expiresAt: "2026-10-06T00:00:00.000Z",
          absoluteExpiresAt: "2026-10-29T00:00:00.000Z",
          userAgent: "UI smoke browser",
          ipAddress: "127.0.0.1",
          current: true,
        }],
      });
    }
    if (path === "/api/v1/auth/mfa/setup") {
      assert.deepEqual(body, { currentPassword: "abc123" });
      return json(200, {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/MovieHub:test?secret=JBSWY3DPEHPK3PXP&issuer=MovieHub",
      });
    }
    if (path === "/api/v1/auth/mfa/enable") {
      if (body.code === "000000") return json(400, { message: "Authentication code is invalid" });
      assert.deepEqual(body, { code: "123456" });
      enabled = true;
      revoked = true;
      return json(200, { recoveryCodes: enrollmentCodes });
    }
    if (path === "/api/v1/auth/mfa/recovery-codes/regenerate") {
      regenerationRequests += 1;
      assert.deepEqual(body, { currentPassword: "abc123", code: "654321" });
      return json(200, { recoveryCodes: regeneratedCodes });
    }
    if (path === "/api/v1/auth/mfa/disable") {
      disableRequests += 1;
      assert.deepEqual(body, { currentPassword: "abc123", code: "111222" });
      enabled = false;
      revoked = true;
      return json(200, { message: "MFA disabled successfully. Please sign in again." });
    }
    return json(404, { message: "Unexpected auth request" });
  });

  return {
    regenerationRequests: () => regenerationRequests,
    disableRequests: () => disableRequests,
  };
};

try {
  const enrollmentPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await installAuthenticatedMocks(enrollmentPage, false);
  await enrollmentPage.goto(`${baseUrl}/account/security`);
  await enrollmentPage.getByText("Disabled", { exact: true }).waitFor();
  await enrollmentPage.getByRole("button", { name: "Enable two-factor authentication" }).click();
  await enrollmentPage.getByLabel("Current password").fill("abc123");
  await enrollmentPage.getByRole("button", { name: "Continue" }).click();
  await enrollmentPage.getByRole("img", { name: "Authenticator QR code" }).waitFor();
  await enrollmentPage.getByLabel("2. Enter the six-digit code").fill("000000");
  await enrollmentPage.getByRole("button", { name: "Verify and enable" }).click();
  await enrollmentPage.getByRole("alert").getByText("Invalid authentication code.").waitFor();
  await enrollmentPage.getByLabel("2. Enter the six-digit code").fill("123456");
  await enrollmentPage.getByRole("button", { name: "Verify and enable" }).click();
  await enrollmentPage.getByText(enrollmentCodes[0], { exact: true }).waitFor();
  await enrollmentPage.reload();
  await enrollmentPage.waitForURL("**/login");
  assert.equal(await enrollmentPage.getByText(enrollmentCodes[0], { exact: true }).count(), 0);
  await enrollmentPage.close();

  const managementPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const counters = await installAuthenticatedMocks(managementPage, true);
  await managementPage.goto(`${baseUrl}/account/security`);
  await managementPage.getByText("Enabled", { exact: true }).waitFor();

  await managementPage.getByRole("button", { name: "Regenerate recovery codes" }).click();
  await managementPage.getByRole("button", { name: "Regenerate codes" }).click();
  assert.equal(counters.regenerationRequests(), 0);
  await managementPage.getByLabel("Current password").fill("abc123");
  await managementPage.getByLabel("Authenticator code").fill("654321");
  await managementPage.getByRole("button", { name: "Regenerate codes" }).click();
  await managementPage.getByText(regeneratedCodes[0], { exact: true }).waitFor();
  await managementPage.getByLabel("I have saved my recovery codes").check();
  await managementPage.getByRole("button", { name: "Done", exact: true }).click();
  await managementPage.getByText("Enabled", { exact: true }).waitFor();
  assert.equal(await managementPage.getByText(regeneratedCodes[0], { exact: true }).count(), 0);

  await managementPage.getByRole("button", { name: "Disable two-factor authentication" }).click();
  await managementPage.getByRole("button", { name: "Disable MFA and sign out" }).click();
  assert.equal(counters.disableRequests(), 0);
  await managementPage.getByLabel("Current password").fill("abc123");
  await managementPage.getByLabel("Authenticator code").fill("111222");
  await managementPage.getByRole("button", { name: "Disable MFA and sign out" }).click();
  await managementPage.waitForURL("**/login");
  assert.equal(counters.disableRequests(), 1);
  await managementPage.close();

  console.log(
    "MFA management UI smoke passed: protected status, QR setup, setup error/success, one-time recovery display, regeneration reauthentication, and disable sign-out.",
  );
} finally {
  await browser.close();
}
