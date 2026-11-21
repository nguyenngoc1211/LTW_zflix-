import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
const now = new Date().toISOString();
const movie = { id: 77, slug: 'ui-smoke', title: 'Phim kiểm tra giao diện', related: [], genres: [], poster_url: '', backdrop_url: '' };
let sent = 0;
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  let body = {};
  if (path === '/api/v1/auth/refresh-token') body = { accessToken: 'movie-ui-smoke', user: { id: 2, username: 'Tác giả', role: 'user' } };
  if (path === '/api/v1/productions/77' || path === '/api/streaming/productions/detail/ui-smoke') body = movie;
  if (path === '/api/streaming/productions/popular') body = [];
  if (path === '/api/v1/productions/77/comments') {
    const root = { id: 100, user_id: 2, username: 'Tác giả', content: 'Bình luận có ảnh', image_urls: ['/uploads/community/posts/example.png'], upvotes: 1, downvotes: 0, reply_count: 1, created_at: now };
    const reply = { id: 101, parent_id: 100, user_id: 2, username: 'Tác giả', content: 'Reply kiểm tra', reply_count: 0, created_at: now };
    body = route.request().method() === 'POST' ? { id: ++sent + 100 } : { items: url.searchParams.get('parentId') === '100' ? [reply] : url.searchParams.has('page') ? [root] : [root, reply], hasMore: false };
  }
  if (path === '/api/v1/productions/77/ratings') body = { items: [] };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'http://127.0.0.1:5174', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(body) });
});
try {
  await page.goto('http://127.0.0.1:5174/movies/77', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const form = page.locator('.movie-unified-discussion .unified-comment-form').first();
  await form.waitFor();
  assert.equal(await page.locator('.movie-unified-discussion').count(), 1);
  const file = { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64') };
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), form.locator('.unified-comment-upload').click()]);
  await chooser.setFiles(file);
  await form.locator('.unified-comment-preview img').waitFor();
  await form.getByRole('button', { name: 'Xóa ảnh' }).click();
  await form.locator('.unified-comment-preview img').waitFor({ state: 'hidden' });
  await form.locator('textarea').evaluate((textarea, base64) => {
    const binary = atob(base64);
    const file = new File([Uint8Array.from(binary, (char) => char.charCodeAt(0))], 'paste.png', { type: 'image/png' });
    const transfer = new DataTransfer(); transfer.items.add(file);
    textarea.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
  }, file.buffer.toString('base64'));
  await form.locator('.unified-comment-preview img').waitFor();
  await form.getByRole('button', { name: 'Xóa ảnh' }).click();
  await form.locator('.unified-comment-preview img').waitFor({ state: 'hidden' });
  await form.locator('textarea').fill('Bình luận kiểm tra');
  await form.locator('input[type=file]').setInputFiles(file);
  await form.getByRole('button', { name: 'Gửi' }).click();
  await page.waitForFunction(() => document.querySelector('.unified-comment-form textarea')?.value === '');
  assert.equal(sent, 1);
  await page.getByRole('button', { name: 'Trả lời (1)' }).click();
  await page.getByText('Reply kiểm tra').waitFor();
  await page.goto('http://127.0.0.1:5174/movies/77?commentId=101', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByText('Reply kiểm tra').waitFor();
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  console.log('movie comment browser smoke passed: composer, file/paste preview, upload, reply deep link, mobile layout');
} finally { await browser.close(); }
