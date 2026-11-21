import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
let lockRequests = 0;
const fixtures = {
  '/api/v1/auth/refresh-token': { accessToken: 'ui-smoke', user: { id: 1, username: 'Admin QA', role: 'admin' } },
  '/api/v1/admin/check': { ok: true },
  '/api/v1/admin/stats': { totalUsers: 42, totalViews: 300, totalComments: 80, totalRatings: 12, avgRating: 4.2, totalRevenue: 150000, totalProductions: 9, totalEpisodes: 50, recentUsers: [{ id: 2, username: 'member', email: 'member@example.test', status: 'active', created_at: new Date().toISOString() }] },
  '/api/v1/admin/views': { daily: [{ stat_date: '2026-11-20', total_views: 30 }] },
  '/api/v1/admin/users': { items: [{ id: 2, username: 'member', email: 'member@example.test', role: 'user', status: 'active' }], total: 1, pages: 1, page: 1 },
  '/api/v1/admin/quests/definitions': { quests: [], achievements: [] },
  '/api/v1/admin/comments': { items: [{ id: 50, username: 'member', production_title: 'Phim kiểm tra', content: 'Bình luận phim đầy đủ', created_at: new Date().toISOString() }], total: 1, page: 1, pages: 1 },
  '/api/v1/admin/ratings': { items: [{ user_id: 2, production_id: 5, username: 'member', production_title: 'Phim kiểm tra', rating: 5, review_title: 'Review đầy đủ', review_content: 'Nội dung review đầy đủ', created_at: new Date().toISOString() }], total: 1, page: 1, pages: 1 },
  '/api/v1/admin/productions': { items: [{ id: 5, title: 'Phim kiểm tra', type: 'movie', release_year: 2026, status: 'ongoing', rating_avg: 5, rating_count: 1 }], total: 1, page: 1, pages: 1 },
  '/api/v1/productions/5': { id: 5, title: 'Phim kiểm tra', type: 'movie', release_year: 2026, rating_avg: 5 },
  '/api/v1/points/config': { rules: { post: { points: 10, daily: 3 } }, rewards: [{ rank: 1, days: 30, min: 800 }] },
};
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/api/v1/**', async (route) => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  let body = fixtures[path];
  if (path === '/api/v1/admin/users/2' && route.request().method() === 'PATCH') {
    const payload = route.request().postDataJSON();
    assert.equal(payload.status, 'disabled');
    assert.ok(payload.reason.length >= 10);
    lockRequests++;
    body = { id: 2, username: 'member', status: 'disabled' };
  }
  if (path === '/api/v1/admin/moderation/reports') body = { stats: { open: 2, flagsOpen: 1 }, items: [], total: 0 };
  if (path === '/api/v1/admin/quests/community-posts') body = { items: [{ id: 999, title: 'Bài viết kiểm tra giao diện', author_id: 2, author_name: 'member', category: 'discussion', content_type: 'community_post', visibility: 'public', comment_count: 2, upvotes: 3, downvotes: 0, created_at: new Date().toISOString() }], total: 21, page: 1, hasMore: true };
  if (path === '/api/v1/community/posts/999') body = { id: 999, title: 'Bài viết kiểm tra giao diện', content: 'Nội dung đầy đủ của bài viết.', author_id: 2, author: { username: 'member' }, category: 'discussion', comment_count: 2, upvotes: 3, downvotes: 0, image_urls: [], production: { title: 'Phim kiểm tra' }, created_at: new Date().toISOString() };
  if (path === '/api/v1/community/posts/999/comments') body = url.searchParams.has('parentId') ? { items: [{ id: 1001, parent_id: 1000, author: { id: 2, username: 'member' }, content: 'Câu trả lời đầy đủ', status: 'active', reply_count: 0, created_at: new Date().toISOString() }], page: 1, hasMore: false } : { items: [{ id: 1000, author: { id: 2, username: 'member' }, content: 'Bình luận đầy đủ', status: 'active', reply_count: 1, created_at: new Date().toISOString() }], page: 1, hasMore: false };
  if (path === '/api/v1/productions/5/comments') body = url.searchParams.get('parentId') === 'root' ? { items: [{ id: 50, username: 'member', user_id: 2, content: 'Bình luận phim đầy đủ', status: 'active', reply_count: 1, created_at: new Date().toISOString() }], page: 1, hasMore: false } : { items: [{ id: 51, username: 'member', user_id: 2, content: 'Reply phim đầy đủ', status: 'active', reply_count: 0, created_at: new Date().toISOString() }], page: 1, hasMore: false };
  if (path === '/api/v1/admin/content/comments') body = { items: [{ id: 1000, author: { id: 2, username: 'member' }, content: 'Bình luận đầy đủ', status: 'active', reply_count: 1, created_at: new Date().toISOString() }], total: 1, page: 1, hasMore: false };
  if (path === '/api/v1/admin/points/transactions') body = { items: [], total: 0, page: 1, hasMore: false };
  if (path.startsWith('/api/v1/admin/points/months/')) body = { rows: [], rewards: [], closed: false };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'http://127.0.0.1:5174', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(body ?? { items: [], orders: [], total: 0 }) });
});
try {
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5174/admin/community-hub', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('heading', { name: 'Tổng quan hoạt động' }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, `horizontal overflow at ${width}px`);
    await page.screenshot({ path: `../tmp/admin-${width}.png`, fullPage: true });
    console.log(`dashboard ${width}px OK`);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const [path, heading] of [
    ['/admin/users', 'Quản lý người dùng'],
    ['/admin/points', 'ZFLIX Points'],
    ['/admin/quests', 'Nhiệm vụ & huy hiệu'],
    ['/admin/community-hub/content', 'Trung tâm nội dung'],
    ['/admin/subscriptions', 'VIP & Doanh thu'],
  ]) {
    await page.goto(`http://127.0.0.1:5174${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('.admin-hub-tab.is-active').waitFor();
    assert.ok((await page.locator('body').textContent()).includes(heading), `${path} did not render ${heading}`);
    assert.ok(page.url().includes('/admin/community-hub'), `${path} did not redirect`);
    console.log(`${path} redirect OK`);
  }
  await page.goto('http://127.0.0.1:5174/admin/community-hub/quests', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: /Tạo nhiệm vụ/ }).click();
  await page.getByRole('dialog').getByRole('heading', { name: /Tạo nhiệm vụ/ }).waitFor();
  console.log('quest editor modal OK');
  await page.goto('http://127.0.0.1:5174/admin/community-hub/content?page=2&category=discussion', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: 'Bài viết kiểm tra giao diện' }).click();
  await page.getByText('Nội dung đầy đủ của bài viết.').waitFor();
  await page.getByRole('button', { name: 'Thao tác bài viết' }).click();
  await page.getByRole('menuitem', { name: 'Khóa tài khoản tác giả' }).click();
  await page.getByRole('textbox', { name: 'Lý do khóa tài khoản' }).fill('Vi phạm quy định cộng đồng');
  await page.getByRole('button', { name: 'Xác nhận khóa' }).click();
  await page.getByText('Tài khoản tác giả đã bị khóa.').waitFor();
  assert.equal(lockRequests, 1);
  await page.getByRole('button', { name: /Xem 1 trả lời/ }).click();
  await page.getByText('Câu trả lời đầy đủ').waitFor();
  await page.getByRole('button', { name: 'Thao tác bình luận 1001' }).click();
  await page.getByRole('menuitem', { name: 'Khóa tài khoản', exact: true }).click();
  await page.getByRole('dialog', { name: 'Khóa tài khoản' }).getByText('member').waitFor();
  await page.getByRole('dialog', { name: 'Khóa tài khoản' }).getByRole('button', { name: 'Hủy' }).click();
  await page.getByRole('button', { name: 'Thao tác bình luận 1001' }).click();
  await page.getByRole('menuitem', { name: 'Xóa nội dung' }).waitFor();
  await page.getByRole('button', { name: 'Thao tác bình luận 1001' }).click();
  await page.getByRole('textbox', { name: 'Tìm bình luận' }).fill('đầy đủ');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.getByText('Kết quả chứa').waitFor();
  await page.screenshot({ path: '../tmp/admin-content-detail.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'post detail overflows mobile');
  assert.ok((await page.locator('.zadmin-sidebar').boundingBox()).x < 0, 'mobile sidebar should be collapsed');
  await page.screenshot({ path: '../tmp/admin-content-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: /Danh sách bài viết/ }).click();
  assert.ok(page.url().includes('page=2') && page.url().includes('category=discussion') && !page.url().includes('postId='));
  console.log('post detail, reply tree and back filters OK');
  await page.getByRole('button', { name: 'Phim', exact: true }).click();
  await page.getByRole('button', { name: 'Phim kiểm tra' }).click();
  await page.getByText('Bình luận phim đầy đủ').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'movie detail overflows mobile');
  await page.screenshot({ path: '../tmp/admin-movie-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: 'Review phim' }).click();
  await page.getByRole('button', { name: 'Xem →' }).click();
  await page.getByRole('dialog').getByText('Nội dung review đầy đủ').waitFor();
  console.log('movie list, threaded comments and review detail OK');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).last().click();
  await page.getByRole('button', { name: 'Gửi thông báo hệ thống' }).click();
  await page.getByRole('dialog').getByText('Thông báo được gửi tới tất cả tài khoản đang hoạt động.').waitFor();
  console.log('broadcast form remains accessible');
  assert.deepEqual(errors, [], 'browser runtime errors');
} finally {
  await browser.close();
}
