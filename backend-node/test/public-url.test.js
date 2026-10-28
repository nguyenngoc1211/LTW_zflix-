import test from "node:test";
import assert from "node:assert/strict";

import { toPublicMediaUrl } from "../src/core/storage/public-url.js";

test("toPublicMediaUrl: giữ nguyên URL http(s)", () => {
  assert.equal(
    toPublicMediaUrl("https://example.com/video.m3u8"),
    "https://example.com/video.m3u8",
  );
});

test("toPublicMediaUrl: ghép key R2 với public domain", () => {
  process.env.R2_PUBLIC_DOMAIN = "https://pub-test.r2.dev/";
  assert.equal(
    toPublicMediaUrl("raw/movies/a.mp4"),
    "https://pub-test.r2.dev/raw/movies/a.mp4",
  );
  assert.equal(
    toPublicMediaUrl("/raw/movies/a.mp4"),
    "https://pub-test.r2.dev/raw/movies/a.mp4",
  );
});

test("toPublicMediaUrl: trả null khi thiếu nguồn hoặc thiếu domain", () => {
  assert.equal(toPublicMediaUrl(null), null);
  process.env.R2_PUBLIC_DOMAIN = "";
  assert.equal(toPublicMediaUrl("raw/movies/a.mp4"), null);
});
