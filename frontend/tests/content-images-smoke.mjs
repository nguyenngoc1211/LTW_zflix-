import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const svg = (width, height, fill) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`)}`;
const images = [svg(80, 40, 'red'), svg(40, 120, 'blue'), svg(70, 70, 'green')];
const now = new Date().toISOString();
const post = (id) => ({ id, author_id: 2, author: { id: 2, username: 'Tác giả' }, content_type: 'community_post', title: 'Bài kiểm tra ảnh', content: 'Nội dung kiểm tra.', category: 'discussion', visibility: 'public', status: 'active', comment_count: 1, image_urls: id === 99 ? images : [images[0]], created_at: now });
const comment = { id: 100, post_id: 99, author_id: 2, author: { id: 2, username: 'Tác giả' }, content: 'Bình luận có ảnh', image_urls: [images[1]], status: 'active', reply_count: 1, thread_count: 1, created_at: now };
const reply = { id: 101, post_id: 99, parent_id: 100, author_id: 2, author: { id: 2, username: 'Tác giả' }, content: 'Reply có ảnh', image_urls: [images[2]], status: 'active', reply_count: 0, thread_count: 0, created_at: now };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/api/v1/**', async (route) => {
  const url = new URL(route.request().url());
  let body = {};
  if (url.pathname === '/api/v1/auth/refresh-token') body = { accessToken: 'image-ui-smoke', user: { id: 2, username: 'Tác giả', role: 'user' } };
  if (url.pathname === '/api/v1/community/posts/99') body = post(99);
  if (url.pathname === '/api/v1/community/posts/98') body = post(98);
  if (url.pathname === '/api/v1/community/posts/99/comments') body = { items: url.searchParams.has('parentId') ? [reply] : [comment], page: 1, hasMore: false };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'http://127.0.0.1:5174', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(body) });
});
try {
  await page.goto('http://127.0.0.1:5174/community/posts/99', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const postImages = page.locator('.zflix-post-image-grid img');
  await postImages.first().waitFor();
  assert.equal(await postImages.count(), 3);
  for (const image of await postImages.all()) {
    const size = await image.evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight }));
    assert.ok(size.width <= size.naturalWidth + 1 && size.height <= size.naturalHeight + 1, 'small post image is not enlarged');
    assert.ok(size.height <= 420 && size.width <= 390, 'post image fits limits');
    assert.ok(Math.abs(size.width / size.height - size.naturalWidth / size.naturalHeight) < 0.02, 'post image keeps aspect ratio');
  }
  await page.getByRole('button', { name: 'Xem ảnh 1 lớn' }).click();
  await page.getByRole('dialog', { name: 'Xem ảnh lớn' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Xem ảnh lớn' }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Xem ảnh 2 lớn' }).click();
  await page.locator('.zflix-image-lightbox').click({ position: { x: 5, y: 5 } });
  await page.getByRole('dialog', { name: 'Xem ảnh lớn' }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Bình luận' }).click();
  await page.locator('.zflix-comment-images img').first().waitFor();
  await page.getByRole('button', { name: 'Trả lời (1)' }).click();
  await page.locator('.zflix-comment-images img').last().waitFor();
  for (const image of await page.locator('.zflix-comment-images img').all()) {
    const size = await image.evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, naturalWidth: node.naturalWidth, naturalHeight: node.naturalHeight }));
    assert.ok(size.width <= 420 && size.height <= 320 && size.width <= size.naturalWidth + 1 && size.height <= size.naturalHeight + 1, 'comment image fits without enlargement');
  }
  await page.locator('.zflix-comment-images button').last().click();
  await page.getByRole('dialog', { name: 'Xem ảnh lớn' }).waitFor();
  await page.getByRole('button', { name: 'Đóng ảnh' }).click();
  await page.goto('http://127.0.0.1:5174/community/posts/98', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.zflix-post-image-grid--single img').waitFor();
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'no mobile horizontal overflow');
  console.log('content image browser smoke passed: landscape/portrait/square, natural size, lightbox, comment/reply, mobile');
} finally { await browser.close(); }
