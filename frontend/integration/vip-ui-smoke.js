import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const vite = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true } });
await vite.listen();
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const order = { id: 1, code: 'ZVIPUITEST', status: 'PENDING', planName: 'VIP 1 tháng', amount: 69000,
  bank: { mode: 'DEMO', qrPayload: 'ZFLIX QR DEMO - KHONG CHUYEN TIEN - ZVIPUITEST' },
  createdAt: new Date().toISOString(), history: [{ action: 'CREATED', actor_id: 1, at: new Date().toISOString() }] };
try {
  for (const width of [375, 768, 1366, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path === '/api/v1/auth/refresh-token' ? { accessToken: 'ui-test', user: { id: 1, username: 'vip_ui_test', role: 'user' } }
        : path === '/api/v1/vip/plans' ? { plans: [{ id: 1, name: 'VIP 1 tháng', months: 1, amount: 69000 }, { id: 2, name: 'VIP 1 năm', months: 12, amount: 690000 }], bankMode: 'DEMO' }
          : path === '/api/v1/vip/orders' ? { orders: [order], vipExpiresAt: null }
            : { items: [], unread: 0 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Credentials': 'true' } });
    });
    await page.goto('http://localhost:5173/vip', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Một trải nghiệm xem phim trọn vẹn hơn.' }).waitFor();
    await page.locator('.vip-qr-panel strong').waitFor();
    assert.match(await page.locator('.vip-qr-panel strong').innerText(), /QR DEMO/);
    assert.equal(await page.getByRole('button', { name: 'Gửi đơn DEMO để xét duyệt' }).count(), 1);
    if (width === 375 || width === 1366) await page.screenshot({ path: `../tmp/vip-redesign-${width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `horizontal overflow at ${width}px`);
    await page.close();
  }
  const paidPage = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await paidPage.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/v1/auth/refresh-token' ? { accessToken: 'ui-test', user: { id: 1, username: 'vip_ui_test', role: 'user' } }
      : path === '/api/v1/vip/plans' ? { plans: [], bankMode: 'DEMO' }
        : path === '/api/v1/vip/orders' ? { orders: [{ ...order, status: 'PAID' }], vipExpiresAt: new Date(Date.now() + 86400000).toISOString() }
          : { items: [], unread: 0 };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Credentials': 'true' } });
  });
  await paidPage.goto('http://localhost:5173/vip', { waitUntil: 'domcontentloaded' });
  await paidPage.getByText('VIP đang hoạt động').waitFor();
  assert.equal(await paidPage.locator('.vip-qr-panel').count(), 0);
  assert.equal(await paidPage.locator('.vip-order-info').count(), 0);
  await paidPage.getByRole('button', { name: 'ZVIPUITEST' }).click();
  assert.equal(await paidPage.locator('.vip-qr-panel').count(), 0);
  assert.equal(await paidPage.locator('.vip-order-info').count(), 1);
  await paidPage.close();
  const communityPage = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const activeExpiry = new Date(Date.now() + 86400000).toISOString();
  const expiredExpiry = new Date(Date.now() - 86400000).toISOString();
  const post = { id: 91, author_id: 11, author: { id: 11, username: 'active_author', vip_expires_at: activeExpiry },
    title: 'Bài kiểm tra VIP', content: 'Nội dung', category: 'discussion', content_type: 'community_post',
    status: 'active', visibility: 'public', created_at: new Date().toISOString(), comment_count: 2, images: [] };
  await communityPage.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = { items: [], unread: 0 };
    if (path === '/api/v1/auth/refresh-token') body = { accessToken: 'ui-test', user: { id: 10, username: 'regular_viewer', role: 'user' } };
    else if (path === '/api/v1/community/posts/91/comments') body = { items: url.searchParams.has('parentId')
      ? [{ id: 103, author_id: 11, author: post.author, status: 'active', content: 'Trả lời VIP', created_at: post.created_at }]
      : [{ id: 101, author_id: 11, author: post.author, status: 'active', content: 'Bình luận VIP', reply_count: 1, created_at: post.created_at },
        { id: 102, author_id: 12, author: { id: 12, username: 'expired_author', vip_expires_at: expiredExpiry }, status: 'active', content: 'Bình luận thường', created_at: post.created_at }], hasMore: false };
    else if (path === '/api/v1/community/posts/91') body = post;
    else if (path === '/api/v1/community/posts') body = { items: [post], hasMore: false };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Credentials': 'true' } });
  });
  await communityPage.goto('http://localhost:5173/community/posts/91', { waitUntil: 'domcontentloaded' });
  await communityPage.getByText('Bài kiểm tra VIP').first().waitFor();
  assert.equal(await communityPage.locator('.community-card-head .vip-member-badge').count(), 1);
  await communityPage.getByRole('button', { name: 'Bình luận' }).first().click();
  await communityPage.getByText('Bình luận VIP').waitFor();
  assert.equal(await communityPage.locator('.movie-comment .vip-member-badge').count(), 1);
  await communityPage.getByRole('button', { name: /Trả lời \(1\)/ }).click();
  await communityPage.getByText('Trả lời VIP').waitFor();
  assert.equal(await communityPage.locator('.movie-comment .vip-member-badge').count(), 2);
  assert.equal(await communityPage.locator('.movie-comment').filter({ hasText: 'Bình luận thường' }).locator('.vip-member-badge').count(), 0);
  await communityPage.close();
  const moviePage = await browser.newPage({ viewport: { width: 768, height: 900 } });
  await moviePage.route('**/api/v1/productions/2147482400/comments**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [
      { id: 502, user_id: 11, username: 'movie_vip_reply', vip_expires_at: activeExpiry, content: 'Trả lời phim VIP', created_at: new Date().toISOString() },
      { id: 503, user_id: 12, username: 'movie_expired_reply', vip_expires_at: expiredExpiry, content: 'Trả lời phim thường', created_at: new Date().toISOString() },
    ], hasMore: false }),
  }));
  await moviePage.goto('http://127.0.0.1:5174/integration/vip-movie-comment.html', { waitUntil: 'domcontentloaded' });
  await moviePage.getByText('Bình luận phim VIP').waitFor();
  assert.equal(await moviePage.locator('.movie-comment .vip-member-badge').count(), 1);
  await moviePage.getByRole('button', { name: /Trả lời \(1\)/ }).click();
  await moviePage.getByText('Trả lời phim VIP').waitFor();
  assert.equal(await moviePage.locator('.movie-comment .vip-member-badge').count(), 2);
  assert.equal(await moviePage.locator('.movie-comment').filter({ hasText: 'Trả lời phim thường' }).last().locator('.vip-member-badge').count(), 0);
  await moviePage.close();
  for (const width of [375, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path === '/api/v1/auth/refresh-token' ? { accessToken: 'ui-admin-test', user: { id: 2, username: 'vip_admin', role: 'admin' } }
        : path === '/api/v1/admin/vip-payments/orders' ? { orders: [{ ...order, status: 'WAITING_REVIEW', username: 'vip_ui_test', email: 'vip@example.invalid' }], total: 1, page: 1 }
          : { items: [], unread: 0 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Credentials': 'true' } });
    });
    await page.goto('http://localhost:5173/admin/vip-payments', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Xét duyệt thanh toán VIP' }).waitFor();
    await page.getByText('ZVIPUITEST').first().click();
    assert.equal(await page.getByRole('button', { name: 'Duyệt và cấp VIP' }).count(), 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `admin horizontal overflow at ${width}px`);
    await page.close();
  }
  console.log('VIP UI browser smoke passed at 375, 768, 1366, 1920px; VIP/expired badges in movie and community comments/replies passed');
} finally { await browser.close(); await vite.close(); }
