import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
const apiUrl = process.env.API_URL || "http://localhost:3000";
const executablePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let submittedChallenge;

try {
  await page.route(`${apiUrl}/api/v1/auth/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/login") {
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          mfaRequired: true,
          challengeToken: "browser-memory-only-challenge",
          expiresInSeconds: 300,
        }),
      });
    }
    if (path === "/api/v1/auth/mfa/verify") {
      submittedChallenge = JSON.parse(route.request().postData());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "test-access-token",
          user: { id: 2, username: "john_doe", email: "john.doe@email.com", role: "user" },
        }),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Refresh session is missing" }),
    });
  });

  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill("john.doe@email.com");
  await page.getByLabel("Password").fill("abc123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Authentication or recovery code").fill("AAAA-BBBB-CCCC-DDDD");
  await page.getByRole("button", { name: "Verify code" }).click();
  await page.waitForURL(baseUrl + "/");
  assert.deepEqual(submittedChallenge, {
    challengeToken: "browser-memory-only-challenge",
    code: "AAAA-BBBB-CCCC-DDDD",
  });
  console.log("MFA login UI smoke passed: password challenge, second step, and success navigation.");
} finally {
  await browser.close();
}
