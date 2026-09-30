import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const apiUrl = process.env.API_URL || "http://localhost:3000";
const executablePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const user = { id: 2, username: "john_doe", email: "john.doe@email.com", role: "user" };

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let signedIn = false;
let forgotRequest;
let resetRequest;
let changeRequest;

try {
  await page.route(`${apiUrl}/api/v1/auth/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (status, body) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (path === "/api/v1/auth/refresh-token") {
      return signedIn
        ? json(200, { accessToken: "ui-test-access-token", user })
        : json(401, { message: "Refresh session is missing" });
    }
    if (path === "/api/v1/auth/forgot-password") {
      forgotRequest = request.postDataJSON();
      return json(200, { message: "If the email exists, password reset instructions have been sent" });
    }
    if (path === "/api/v1/auth/reset-password") {
      resetRequest = request.postDataJSON();
      return json(200, { message: "Password reset successfully. Please sign in again." });
    }
    if (path === "/api/v1/auth/mfa/status") {
      return json(200, { enabled: false, enabledAt: null, recoveryCodesRemaining: 0 });
    }
    if (path === "/api/v1/auth/sessions") {
      return json(200, { sessions: [] });
    }
    if (path === "/api/v1/auth/change-password") {
      changeRequest = request.postDataJSON();
      signedIn = false;
      return json(200, { message: "Password changed successfully. Please sign in again." });
    }
    return json(404, { message: "Unexpected auth request" });
  });

  await page.goto(`${frontendUrl}/login`);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.waitForURL("**/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: "Request reset" }).click();
  await page.getByRole("status").waitFor();
  assert.deepEqual(forgotRequest, { email: user.email });

  await page.goto(`${frontendUrl}/reset-password?token=ui-test-reset-token`);
  await page.getByLabel("New password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Confirm new password").fill("new-password-123");
  assert.equal(new URL(page.url()).search, "", "reset token should leave the address bar");
  await page.getByRole("button", { name: "Reset password" }).click();
  await page.waitForURL("**/login");
  await page.getByText("Password updated. Please sign in again.").waitFor();
  assert.deepEqual(resetRequest, {
    token: "ui-test-reset-token",
    newPassword: "new-password-123",
  });

  signedIn = true;
  await page.goto(`${frontendUrl}/account/security`);
  await page.getByRole("heading", { name: "Change password" }).waitFor();
  await page.getByLabel("Current password").first().fill("current-password-123");
  await page.getByLabel("New password", { exact: true }).fill("next-password-123");
  await page.getByLabel("Confirm new password").fill("next-password-123");
  await page.getByRole("button", { name: "Change password" }).click();
  await page.waitForURL("**/login?passwordChanged=1");
  await page.getByText("Password updated. Please sign in again.").waitFor();
  assert.deepEqual(changeRequest, {
    currentPassword: "current-password-123",
    newPassword: "next-password-123",
  });

  console.log("Password lifecycle UI smoke passed: forgot, reset, and change password flows.");
} finally {
  await browser.close();
}
