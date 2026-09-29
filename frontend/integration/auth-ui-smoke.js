import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const apiUrl = process.env.API_URL || "http://localhost:3000";
const executablePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(`${baseUrl}/admin`);
  await page.waitForURL("**/login");
  assert.equal(new URL(page.url()).pathname, "/login");

  await page.getByLabel("Email").fill("admin@moviehub.com");
  await page.getByLabel("Password").fill("abc123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
  assert.equal(new URL(page.url()).pathname, "/admin");
  await page.getByText("admin", { exact: true }).waitFor();

  await page.reload();
  await page.waitForURL("**/admin");

  const refreshCookie = (await page.context().cookies(`${apiUrl}/api/v1/auth/`)).find(
    (cookie) => cookie.name === "refreshToken",
  );
  assert.ok(refreshCookie);
  const revokedSession = await fetch(`${apiUrl}/api/v1/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: `${refreshCookie.name}=${refreshCookie.value}`,
      Origin: baseUrl,
    },
  });
  assert.equal(revokedSession.status, 204);

  await page.evaluate(async () => {
    const { apiRequest } = await import("/src/services/api.js");
    await apiRequest("/api/v1/admin/check").catch(() => undefined);
  });
  await page.waitForURL("**/login");

  await page.getByLabel("Email").fill("admin@moviehub.com");
  await page.getByLabel("Password").fill("abc123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
  await page.getByText("admin", { exact: true }).click();
  await page.getByText("Log out", { exact: true }).click();
  await page.waitForURL("**/login");

  await page.goto(`${baseUrl}/admin`);
  await page.waitForURL("**/login");
  await page.getByLabel("Email").fill("john.doe@email.com");
  await page.getByLabel("Password").fill("abc123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(baseUrl + "/");
  assert.equal(new URL(page.url()).pathname, "/");

  await page.goto(`${baseUrl}/admin`);
  await page.waitForURL(baseUrl + "/");
  assert.equal(new URL(page.url()).pathname, "/");

  const mfaPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let submittedChallenge;
  await mfaPage.route(`${apiUrl}/api/v1/auth/**`, async (route) => {
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
  await mfaPage.goto(`${baseUrl}/login`);
  await mfaPage.getByLabel("Email").fill("john.doe@email.com");
  await mfaPage.getByLabel("Password").fill("abc123");
  await mfaPage.getByRole("button", { name: "Sign in" }).click();
  await mfaPage.getByLabel("Authentication or recovery code").fill("AAAA-BBBB-CCCC-DDDD");
  await mfaPage.getByRole("button", { name: "Verify code" }).click();
  await mfaPage.waitForURL(baseUrl + "/");
  assert.deepEqual(submittedChallenge, {
    challengeToken: "browser-memory-only-challenge",
    code: "AAAA-BBBB-CCCC-DDDD",
  });
  await mfaPage.close();

  console.log(
    "UI auth checks passed: existing auth regressions and the in-memory MFA second step.",
  );
} finally {
  await browser.close();
}
