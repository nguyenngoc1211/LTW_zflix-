import { chromium } from "playwright-core";

const expected = new Map([
  [7, "Titanic"],
  [54, "Crash Landing On You"],
  [11, "La La Land"],
]);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const posterFailures = [];
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "image") posterFailures.push({ host: new URL(request.url()).hostname, error: request.failure()?.errorText });
  });
  await page.goto(process.env.CHATBOT_TEST_URL || "http://localhost:5173/", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.getByRole("button", { name: "Mở trợ lý phim" }).click();
  const reply = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/chat") && response.request().method() === "POST",
  { timeout: 120000 });
  const input = page.getByRole("textbox", { name: "Tin nhắn cho Zflix AI" });
  await input.fill("Gợi ý Titanic, Crash Landing On You và La La Land");
  await input.press("Enter");

  const response = await reply;
  if (!response.ok()) throw new Error(`Live chat API returned ${response.status()}`);
  const data = await response.json();
  if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("The answer is missing");
  if (!Array.isArray(data.movies)) throw new Error("The live API response has no movies field");
  const movieIds = new Set(data.movies.map((movie) => Number(movie.id)));
  for (const [id, title] of expected) {
    const movie = data.movies.find((item) => Number(item.id) === id);
    if (!movie || movie.title !== title || !movie.poster || !movie.year || !Array.isArray(movie.genres) || movie.rating == null || typeof movie.description !== "string") {
      throw new Error(`Incomplete MongoDB movie in API response: ${title}`);
    }
  }
  if (await page.locator(".zflix-chat-source-list a").count()) {
    throw new Error("Source ID links should only appear for text-only replies");
  }
  if (movieIds.has(28)) throw new Error("Unrelated retrieved movie Friends became a card");

  const cards = page.locator(".zflix-chat-movie");
  await cards.first().waitFor({ timeout: 15000 });
  if (await cards.count() !== data.movies.length) throw new Error("API movies were lost before rendering");
  for (const [id, title] of expected) {
    const card = cards.filter({ hasText: title });
    if (await card.count() !== 1) throw new Error(`MovieCard missing: ${title}`);
    if (!await card.locator("img").getAttribute("src")) throw new Error(`Poster missing: ${title}`);
    if (await card.getByRole("link", { name: "Xem phim" }).getAttribute("href") !== `/movies/${id}`) {
      throw new Error(`Wrong movie detail route: ${title}`);
    }
    if (await page.locator(`.zflix-chat-source-list a[href="/movies/${id}"]`).count()) {
      throw new Error(`Duplicate Phim #${id} link`);
    }
  }
  if (!(await page.locator(".zflix-chat-markdown").last().innerText()).includes("Titanic")) {
    throw new Error("The AI answer was lost");
  }
  await page.waitForTimeout(5000);
  const posterStates = await cards.evaluateAll((items) => items.map((item) => ({
    title: item.querySelector("strong")?.textContent,
    loaded: Boolean(item.querySelector("img")?.naturalWidth),
  })));
  console.log("Poster load states:", posterStates);
  console.log("Image request failures:", posterFailures);
  await page.screenshot({ path: "../tmp/chatbot-live-moviecards.png" });
  console.log("Live API -> Zflix popup: three MongoDB MovieCards, poster URLs, routes, answer and no duplicate links passed");
} finally {
  await browser.close();
}
