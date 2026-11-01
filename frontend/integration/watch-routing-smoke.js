import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/api/v1/history/**', (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 200, json: {} }) : route.continue());
  if (!process.env.SERIES_ONLY) {
    await page.goto('http://localhost:5173/movies/54');
    await page.getByRole('button', { name: /Watch now/i }).click({ timeout: 30000 });
    await page.waitForURL('**/movies/54?ep=1');
    console.log('Watch Now opens canonical player');
  }
  for (const [path, redirected, expected] of process.env.SERIES_ONLY ? [] : [
    ['/watch-episode/62?pos=20', true, 20],
    ['/movies/54?ep=1', false, null],
    ['/movies/54?ep=1&pos=20', false, 20],
    ['/movies/54?ep=1&pos=0', false, 0],
  ]) {
    await page.goto(`http://localhost:5173${path}`);
    if (redirected) await page.waitForURL('**/movies/54?ep=1&pos=20');
    await page.locator('video').waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: /Chụp khoảnh khắc/ }).waitFor();
    if (expected !== null) {
      await page.waitForFunction((value) => {
        const video = document.querySelector('video');
        return video && video.readyState >= 1 && Math.abs(video.currentTime - value) < 5;
      }, expected, { timeout: 30000 });
    }
    console.log(`${path}: full player ready${expected === null ? '' : `, position near ${expected}s`}`);
  }
  if (!process.env.SERIES_ONLY) {
    await page.getByRole('button', { name: /Chụp khoảnh khắc/ }).click();
    await page.getByText('Vui lòng đăng nhập để chia sẻ khoảnh khắc.').waitFor();
    await page.addInitScript(() => {
      if (new URLSearchParams(location.search).get('pos') === '999999') HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
    await page.goto('http://localhost:5173/movies/54?ep=1&pos=999999');
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v && Number.isFinite(v.duration) && v.duration > 1 && Math.abs(v.currentTime - (v.duration - 1)) < 0.1; }, null, { timeout: 30000 });
    console.log('screenshot requires login; position above duration is clamped');
  }
  // The real series fixture is VIP-locked. Use its real metadata and a public
  // test media source in this isolated browser only; no auth policy is changed.
  const publicMedia = await (await fetch('http://localhost:3000/api/v1/episodes/62')).json();
  await page.route('**/api/streaming/episodes/seasons/32/episodes', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const unlock = (items) => items.map((episode) => ({ ...episode, locked: false, video_url: publicMedia.video_url }));
    await route.fulfill({ response, json: Array.isArray(data) ? unlock(data) : { ...data, data: unlock(data.data) } });
  });
  await page.goto('http://localhost:5173/watch-episode/43?pos=20');
  await page.waitForURL('**/movies/21?ss=2&ep=1&pos=20', { timeout: 30000 });
  try { await page.waitForFunction(() => { const video = document.querySelector('video'); return video?.readyState >= 1 && video.currentTime >= 19 && video.currentTime < 30; }, null, { timeout: 30000 }); }
  catch (error) { console.log('Series media state:', await page.evaluate(() => { const v = document.querySelector('video'); return v ? { readyState: v.readyState, currentTime: v.currentTime, duration: v.duration, error: v.error?.code, hasSource: Boolean(v.currentSrc) } : { text: document.body.innerText.slice(0, 500) }; })); throw error; }
  await page.reload();
  await page.waitForFunction(() => { const video = document.querySelector('video'); return video?.readyState >= 1 && video.currentTime >= 19 && video.currentTime < 30; }, null, { timeout: 30000 });
  console.log('series season 2: correct URL and refresh seek');
  await page.getByText('Chapter Two: Trick or Treat, Freak', { exact: true }).click({ timeout: 10000 });
  await page.waitForURL((url) => url.searchParams.get('ep') === '2' && !url.searchParams.has('pos'));
  console.log('episode switch: old pos removed');
  await page.goto('http://localhost:5173/watch-episode/99999999?pos=20');
  await page.getByText(/Không tìm thấy tập phim/).waitFor({ timeout: 15000 });
  assert.ok(page.url().includes('/watch-episode/99999999'));
  console.log('invalid episode: error displayed');
} finally {
  await browser.close();
}
