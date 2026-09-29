import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
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

  console.log("UI auth checks passed: admin guard/login/reload/logout and user redirect.");
} finally {
  await browser.close();
}
