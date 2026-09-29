import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const apiUrl = process.env.API_URL || "http://localhost:3000";
const executablePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const user = { id: 2, username: "john_doe", email: "john.doe@email.com", role: "user" };
const timestamp = "2026-09-29T00:00:00.000Z";

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let revoked = false;
let sessions = [
  {
    id: "current-session",
    createdAt: timestamp,
    lastUsedAt: timestamp,
    expiresAt: "2026-10-06T00:00:00.000Z",
    absoluteExpiresAt: "2026-10-29T00:00:00.000Z",
    userAgent: "Current browser",
    ipAddress: "127.0.0.1",
    current: true,
  },
  {
    id: "other-session-one",
    createdAt: timestamp,
    lastUsedAt: null,
    expiresAt: "2026-10-06T00:00:00.000Z",
    absoluteExpiresAt: "2026-10-29T00:00:00.000Z",
    userAgent: "Other browser one",
    ipAddress: "10.0.0.2",
    current: false,
  },
  {
    id: "other-session-two",
    createdAt: timestamp,
    lastUsedAt: timestamp,
    expiresAt: "2026-10-06T00:00:00.000Z",
    absoluteExpiresAt: "2026-10-29T00:00:00.000Z",
    userAgent: "Other browser two",
    ipAddress: "10.0.0.3",
    current: false,
  },
];

try {
  await page.route(`${apiUrl}/api/v1/auth/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (status, value) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(value),
    });

    if (path === "/api/v1/auth/refresh-token") {
      return revoked
        ? json(401, { message: "Refresh session is invalid or expired" })
        : json(200, { accessToken: "session-management-token", user });
    }
    if (path === "/api/v1/auth/mfa/status") {
      return json(200, { enabled: false, enabledAt: null, recoveryCodesRemaining: 0 });
    }
    if (path === "/api/v1/auth/sessions" && request.method() === "GET") {
      return json(200, { sessions });
    }
    if (path.startsWith("/api/v1/auth/sessions/") && request.method() === "DELETE") {
      const sessionId = decodeURIComponent(path.split("/").at(-1));
      sessions = sessions.filter((session) => session.id !== sessionId);
      return route.fulfill({ status: 204 });
    }
    if (path === "/api/v1/auth/logout-others") {
      sessions = sessions.filter((session) => session.current);
      return route.fulfill({ status: 204 });
    }
    if (path === "/api/v1/auth/logout-all") {
      sessions = [];
      revoked = true;
      return route.fulfill({ status: 204 });
    }
    return json(404, { message: "Unexpected auth request" });
  });

  await page.goto(`${baseUrl}/account/security`);
  await page.getByRole("heading", { name: "Active sessions" }).waitFor();
  await page.getByText("Current session", { exact: true }).waitFor();
  await page.getByText("Other browser one", { exact: true }).waitFor();

  const firstOther = page.getByRole("listitem").filter({ hasText: "Other browser one" });
  await firstOther.getByRole("button", { name: "Sign out" }).click();
  await page.getByText("Other browser one", { exact: true }).waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/account/security");
  await page.getByText("Current session", { exact: true }).waitFor();

  await page.getByRole("button", { name: "Sign out other sessions" }).click();
  await page.getByText("Other browser two", { exact: true }).waitFor({ state: "detached" });
  assert.deepEqual(sessions.map((session) => session.id), ["current-session"]);
  assert.equal(new URL(page.url()).pathname, "/account/security");

  await page.getByRole("button", { name: "Sign out all sessions" }).click();
  await page.waitForURL("**/login");
  assert.equal(revoked, true);

  console.log(
    "Session management UI smoke passed: list/current marker, single revoke, logout others, retained current auth, and logout-all redirect.",
  );
} finally {
  await browser.close();
}
