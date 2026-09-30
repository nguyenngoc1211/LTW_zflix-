import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const apiUrl = process.env.API_URL || "http://localhost:3000";
const executablePath =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const submitted = [];

try {
  await page.route(`${apiUrl}/api/v1/auth/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/register") {
      const body = route.request().postDataJSON();
      submitted.push(body);
      const duplicate = body.email === "taken@example.test";
      return route.fulfill({
        status: duplicate ? 409 : 201,
        contentType: "application/json",
        body: JSON.stringify({
          message: duplicate
            ? "Email or username is already in use"
            : "Account created. Please sign in.",
        }),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Refresh session is missing" }),
    });
  });

  await page.goto(`${frontendUrl}/login`);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForURL("**/register");
  await page.getByLabel("Username").fill("new_user");
  await page.getByLabel("Email").fill("taken@example.test");
  await page.getByLabel("Password", { exact: true }).fill("valid-password-123");
  await page.getByLabel("Confirm password").fill("different-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("alert").getByText("Passwords do not match.").waitFor();
  assert.equal(submitted.length, 0);

  await page.getByLabel("Confirm password").fill("valid-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("alert").getByText("Email or username is already in use").waitFor();
  assert.equal(submitted.length, 1);

  await page.getByLabel("Email").fill("new@example.test");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/login");
  await page.getByText("Account created. Please sign in.").waitFor();
  assert.deepEqual(submitted[1], {
    username: "new_user",
    email: "new@example.test",
    password: "valid-password-123",
  });
  console.log("Registration UI smoke passed: link, validation, duplicate error, and sign-in handoff.");
} finally {
  await browser.close();
}
