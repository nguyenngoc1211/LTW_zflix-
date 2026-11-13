import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("**/api/v1/chat", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ conversation_id: "text-check", answer: "Chào bạn! **Mình có thể gợi ý phim.**", sources: [{ production_id: 1 }] }),
  }));
  await page.goto(process.env.CHATBOT_TEST_URL || "http://localhost:5173/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("button", { name: "Mở trợ lý phim" }).click();
  const input = page.getByRole("textbox", { name: "Tin nhắn cho Zflix AI" });
  await input.fill("Gợi ý một phim hành động trong Zflix");
  const reply = page.waitForResponse((response) => response.url().endsWith("/api/v1/chat") && response.request().method() === "POST", { timeout: 90000 });
  await input.press("Enter");
  const response = await reply;
  if (!response.ok()) throw new Error(`Chat API returned ${response.status()}`);
  const answer = await response.json();
  if (typeof answer.answer !== "string" || !answer.answer.trim()) throw new Error("Chat response has no answer");
  await page.locator(".zflix-chat-typing").waitFor({ state: "hidden", timeout: 10000 });
  if (!(await page.locator(".zflix-chat-markdown").last().innerText()).trim()) throw new Error("AI answer was not rendered");
  if (await page.locator(".zflix-chat-movie").count()) throw new Error("Text-only reply must not create MovieCards");
  if (await page.locator('.zflix-chat-source-list a[href="/movies/1"]').count() !== 1) throw new Error("Legacy source link is missing");

  await page.getByRole("button", { name: "Bắt đầu cuộc trò chuyện mới" }).click();
  await page.unroute("**/api/v1/chat");
  await page.route("**/api/v1/chat", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      conversation_id: "ui-check",
      answer: "# Gợi ý hôm nay\n\n- **Phim thử nghiệm**\n- [Xem nguồn](https://example.com)\n- [Liên kết không an toàn](javascript:alert(1))\n\n<script>alert('x')</script>",
      movies: [{
        id: 947,
        title: "Phim thử nghiệm",
        poster: "/chatbot-test-poster.svg",
        year: 2025,
        genres: ["Hành động"],
        rating: 4.5,
        description: "Mô tả ngắn dùng để kiểm tra thẻ phim.",
      }, {
        id: 948,
        title: "Phim không có poster",
        poster: null,
        year: 2024,
        genres: [],
        rating: null,
        description: "",
      }],
      sources: [{ production_id: 947 }],
    }),
  }));
  await page.route("**/chatbot-test-poster.svg", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="#9f1622"/></svg>',
  }));
  await page.getByRole("button", { name: "Gợi ý phim hành động" }).click();
  await page.getByRole("heading", { name: "Gợi ý hôm nay" }).waitFor();
  await page.locator(".zflix-chat-movie").first().waitFor();
  if (await page.locator(".zflix-chat-movie").count() !== 2) throw new Error("Multiple cards were not rendered");
  if (await page.locator(".zflix-chat-movie").nth(1).locator("img").count()) throw new Error("Missing poster must use the placeholder");
  if (await page.locator('.zflix-chat-bubble a[href^="javascript:"]').count()) throw new Error("Unsafe Markdown link rendered");
  if (await page.locator(".zflix-chat-bubble script").count()) throw new Error("Raw HTML rendered as DOM");
  const external = page.getByRole("link", { name: "Xem nguồn" });
  if (await external.getAttribute("rel") !== "noopener noreferrer nofollow") throw new Error("External link is not protected");
  const movieLinks = page.getByRole("link", { name: "Xem phim", exact: true });
  if (await movieLinks.nth(0).getAttribute("href") !== "/movies/947" || await movieLinks.nth(1).getAttribute("href") !== "/movies/948") throw new Error("Movie routes are incorrect");
  await page.screenshot({ path: "../tmp/chatbot-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../tmp/chatbot-mobile.png" });

  await page.getByRole("button", { name: "Bắt đầu cuộc trò chuyện mới" }).click();
  await input.fill("Dòng đầu");
  await input.press("Shift+Enter");
  await input.type("Dòng hai");
  if (!(await input.inputValue()).includes("\n")) throw new Error("Shift+Enter did not insert a newline");
  await input.press("Enter");
  await page.getByRole("heading", { name: "Gợi ý hôm nay" }).waitFor();
  await page.getByRole("button", { name: "Thu nhỏ chatbot" }).click();
  await page.getByRole("button", { name: "Mở lại trợ lý phim" }).click();
  await page.getByRole("button", { name: "Đóng chatbot" }).click();
  await page.getByRole("button", { name: "Mở trợ lý phim" }).waitFor();
  console.log("Chatbot UI: legacy text reply, Markdown/XSS, multiple cards, missing poster, responsive layout, keyboard and controls passed");
} finally {
  await browser.close();
}
