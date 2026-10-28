import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET ||= "test-only-secret-with-at-least-thirty-two-characters";
process.env.PLAYBACK_TOKEN_SECRET = "test-playback-secret-with-at-least-32-characters";
process.env.R2_PUBLIC_DOMAIN = "https://pub-test.r2.dev";

const {
  buildPlaybackUrl,
  createPlaybackToken,
  verifyPlaybackToken,
  toObjectPath,
} = await import("../src/core/security/playback-token.js");
const { canAccessPremium, isVipActive } = await import("../src/core/security/entitlements.js");

const extractToken = (url) => {
  const match = String(url).match(/^\/api\/v1\/hls\/t\/([^/]+)\/(.+)$/);
  assert.ok(match, `không phải URL proxy hợp lệ: ${url}`);
  return { token: match[1], objectPath: match[2] };
};

test("toObjectPath nhận key raw và URL R2", () => {
  assert.equal(toObjectPath("raw/movies/a.mp4"), "raw/movies/a.mp4");
  assert.equal(toObjectPath("/hls/1/playlist.m3u8"), "hls/1/playlist.m3u8");
  assert.equal(
    toObjectPath("https://pub-test.r2.dev/hls/1/playlist.m3u8"),
    "hls/1/playlist.m3u8",
  );
  assert.equal(toObjectPath("https://example.com/a.mp4"), null);
});

test("buildPlaybackUrl trả URL proxy kèm token cho nội dung free", () => {
  const url = buildPlaybackUrl("https://pub-test.r2.dev/hls/1/playlist.m3u8");
  const { token, objectPath } = extractToken(url);
  assert.equal(objectPath, "hls/1/playlist.m3u8");
  assert.equal(verifyPlaybackToken(token, "hls/1/playlist.m3u8"), true);
  assert.equal(verifyPlaybackToken(token, "hls/1/segment0.ts"), true);
  assert.equal(verifyPlaybackToken(token, "hls/2/playlist.m3u8"), false);
});

test("buildPlaybackUrl khóa nội dung premium với khách và user thường", () => {
  const price = "https://pub-test.r2.dev/hls/1/playlist.m3u8";
  assert.equal(buildPlaybackUrl(price, { premium: true, user: null }), null);
  assert.equal(
    buildPlaybackUrl(price, {
      premium: true,
      user: { role: "user", vipExpiresAt: new Date(Date.now() - 60_000).toISOString() },
    }),
    null,
  );
});

test("buildPlaybackUrl mở nội dung premium cho VIP còn hạn và staff", () => {
  const price = "https://pub-test.r2.dev/hls/1/playlist.m3u8";
  assert.ok(
    buildPlaybackUrl(price, {
      premium: true,
      user: { role: "user", vipExpiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    }),
  );
  assert.ok(buildPlaybackUrl(price, { premium: true, user: { role: "admin" } }));
});

test("buildPlaybackUrl giữ nguyên URL ngoài R2 cho nội dung free", () => {
  assert.equal(
    buildPlaybackUrl("https://example.com/movie.mp4"),
    "https://example.com/movie.mp4",
  );
});

test("token file lẻ chỉ dùng đúng path", () => {
  const url = buildPlaybackUrl("raw/movies/a.mp4");
  const { token } = extractToken(url);
  assert.equal(verifyPlaybackToken(token, "raw/movies/a.mp4"), true);
  assert.equal(verifyPlaybackToken(token, "raw/movies/b.mp4"), false);
});

test("token hết hạn, bị sửa hoặc sai định dạng bị từ chối", () => {
  const scope = "hls/1/";
  const expired = createPlaybackToken(scope, { now: Date.now() - 700_000, ttlSeconds: 600 });
  assert.equal(verifyPlaybackToken(expired, "hls/1/playlist.m3u8"), false);

  const valid = createPlaybackToken(scope);
  assert.equal(verifyPlaybackToken(`${valid}x`, "hls/1/playlist.m3u8"), false);
  assert.equal(verifyPlaybackToken("not-a-token", "hls/1/playlist.m3u8"), false);
  assert.equal(verifyPlaybackToken(valid, "hls/1/../2/playlist.m3u8"), false);
});

test("isVipActive và canAccessPremium xử lý thời hạn và role", () => {
  assert.equal(isVipActive(null), false);
  assert.equal(isVipActive(new Date(Date.now() - 1).toISOString()), false);
  assert.equal(isVipActive(new Date(Date.now() + 60_000).toISOString()), true);
  assert.equal(canAccessPremium(null), false);
  assert.equal(canAccessPremium({ role: "user" }), false);
  assert.equal(canAccessPremium({ role: "moderator" }), true);
});
