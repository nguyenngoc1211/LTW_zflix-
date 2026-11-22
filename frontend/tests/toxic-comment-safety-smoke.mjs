import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
const errors = [];
const now = new Date().toISOString();
const movie = {
  id: 77,
  slug: "toxic-comment-smoke",
  title: "Phim kiểm tra bình luận",
  related: [],
  genres: [],
  poster_url: "",
  backdrop_url: "",
};
let commentContent = "Tôi thích phần lồng tiếng";
let commentToxic = false;
let postedContent = "";

page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/**", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  let body = {};

  if (path === "/api/v1/auth/refresh-token") {
    body = { accessToken: "toxic-comment-smoke", user: { id: 2, username: "Tác giả", role: "user" } };
  } else if (path === "/api/v1/productions/77" || path === "/api/streaming/productions/detail/toxic-comment-smoke") {
    body = movie;
  } else if (path === "/api/streaming/productions/popular") {
    body = [];
  } else if (path === "/api/v1/productions/77/comments") {
    if (request.method() === "POST") {
      postedContent = request.postDataJSON().content;
      body = {
        id: 101,
        content: postedContent,
        isToxic: true,
        warning: "Bình luận có thể chứa ngôn từ không phù hợp. Vui lòng kiểm tra lại nội dung.",
      };
    } else {
      body = {
        items: [{
          id: 100,
          user_id: 2,
          username: "Tác giả",
          content: commentContent,
          is_toxic: commentToxic ? 1 : 0,
          image_urls: [],
          upvotes: 0,
          downvotes: 0,
          reply_count: 0,
          created_at: now,
        }],
        hasMore: false,
      };
    }
  } else if (path === "/api/v1/comments/100" && request.method() === "PATCH") {
    commentContent = request.postDataJSON().content;
    commentToxic = commentContent.includes("lồn");
    body = {
      id: 100,
      content: commentContent,
      isToxic: commentToxic,
      warning: commentToxic ? "Bình luận có thể chứa ngôn từ không phù hợp." : null,
    };
  } else if (path === "/api/v1/productions/77/ratings") {
    body = { items: [] };
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

try {
  await page.goto("http://localhost:5173/movies/77", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByText(commentContent, { exact: true }).waitFor({ timeout: 30000 });

  const rootComment = page.locator("#movie-comment-100");
  assert.equal(await rootComment.locator(".toxic-comment.is-hidden").count(), 0);

  await rootComment.locator(".community-action-trigger").click();
  await page.getByRole("menuitem").filter({ hasText: "Sửa" }).click();
  const editForm = rootComment.locator(".unified-comment-form");
  await editForm.locator("textarea").fill("Tôi thích phần lồn");
  await editForm.getByRole("button", { name: "Gửi" }).click();
  await rootComment.locator(".toxic-comment.is-hidden").waitFor();

  await rootComment.locator(".toxic-comment.is-hidden").click();
  assert.equal(await rootComment.locator(".toxic-comment.is-hidden").count(), 0);
  assert.equal(await rootComment.getByText("Tôi thích phần lồn", { exact: true }).count(), 1);
  console.log("CM-06/CM-07 pass: toxic edit is hidden and can be revealed");

  const composer = page.locator(".movie-unified-discussion .unified-comment-form").first();
  await composer.locator("textarea").fill("Bình luận này có cặc");
  await composer.getByRole("button", { name: "Gửi" }).click();
  await page.locator(".toxic-comment-notice").waitFor();
  assert.equal(postedContent, "Bình luận này có cặc");
  assert.equal(await composer.locator("textarea").inputValue(), "");
  assert.deepEqual(errors, []);
  console.log("CM-05 pass: flagged comment is accepted with a warning");
} finally {
  await browser.close();
}
