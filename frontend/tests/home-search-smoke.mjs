import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];

page.on("pageerror", (error) => errors.push(error.message));
if (!process.env.LIVE_SEARCH) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname === "/api/v1/auth/refresh-token") {
      body = { accessToken: "search-ui-smoke", user: null };
    } else if (url.pathname === "/api/v1/filters") {
      body = { genres: [], countries: [], years: [] };
    } else if (url.pathname === "/api/v1/productions/top") {
      body = { items: [] };
    } else if (url.pathname === "/api/v1/productions/suggest") {
      body = { items: [] };
    } else if (url.pathname === "/api/v1/productions") {
      body = {
        items: [{
          id: 10,
          title: "Interstellar",
          release_year: 2014,
          rating_avg: 5,
          poster_url: "",
          genres: [],
        }],
        total: 1,
        page: 1,
        pages: 1,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "http://localhost:5173",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify(body),
    });
  });
}

try {
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".movie-card").first().waitFor({ timeout: 30000 });

  const input = page.getByLabel("Tên phim");
  await input.fill("Interstellar");
  await page.getByRole("button", { name: "Tìm phim" }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Đang tải phim..."));
  assert.equal(await page.locator(".movie-card h3").filter({ hasText: "Interstellar" }).count(), 1);

  await page.getByRole("button", { name: "Tìm phim" }).click();
  await page.waitForTimeout(750);
  assert.equal(
    await page.getByText("Đang tải phim...", { exact: true }).count(),
    0,
    "Repeated search with unchanged filters leaves the page in loading state",
  );
  assert.deepEqual(errors, []);
  console.log("home search smoke passed: initial and repeated search complete");
} finally {
  await browser.close();
}
