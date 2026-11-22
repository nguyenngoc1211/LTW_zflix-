import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { rankProductsV2, normalizeText, tokenize, validateAffiliateTarget } = await import("../src/modules/visual-shopping/ranking.js");
const { productEmbeddings, collapseProductHits } = await import("../src/modules/visual-shopping/vector.index.js");
const { imageUrlsFor } = await import("../src/modules/visual-shopping/catalog-import.js");
const { buildQueryVariants } = await import("../src/modules/visual-shopping/query-variants.js");
const { mapRegionToVideoPixels } = await import("../../frontend/src/utils/cropMath.js");
const sharp = (await import("sharp")).default;

test("imageUrlsFor accepts multiple pipe-separated catalog images", () => {
  assert.deepEqual(imageUrlsFor({ image_urls: " first.jpg | second.jpg | first.jpg " }), [
    "first.jpg",
    "second.jpg",
  ]);
  assert.deepEqual(imageUrlsFor({ image_url: "legacy.jpg" }), ["legacy.jpg"]);
});

test("productEmbeddings reads the primary vector and additional catalog views", () => {
  const vectors = productEmbeddings({
    embedding: JSON.stringify([1, 0, 0]),
    embedding_variants: [
      { image_url: "side.jpg", embedding: [0, 1, 0] },
      { image_url: "broken.jpg", embedding: "not-json" },
    ],
  });
  assert.deepEqual(vectors, [[1, 0, 0], [0, 1, 0]]);
});

test("collapseProductHits keeps the best image-view score per product", () => {
  assert.deepEqual(collapseProductHits([
    { productId: 8, similarity: 0.72 },
    { productId: 8, similarity: 0.91 },
    { productId: 3, similarity: 0.84 },
    { productId: 4, similarity: Number.NaN },
  ]), [
    { productId: 8, similarity: 0.91 },
    { productId: 3, similarity: 0.84 },
  ]);
});

test("normalizeText and tokenize support Vietnamese text matching", () => {
  assert.equal(normalizeText("Cốc sứ cà phê đỏ"), "coc su ca phe do");
  assert.deepEqual(tokenize("Cốc sứ cà phê"), ["coc", "phe"]);
});

test("rankProductsV2 returns empty when top-1 and top-2 are too close", () => {
  const base = { availability: 1, category: "Đồ gia dụng", color: "đỏ", description: "" };
  const ranked = rankProductsV2([
    { ...base, id: 1, name: "Cốc sứ đỏ", similarity: 0.72 },
    { ...base, id: 2, name: "Cốc sứ xanh", similarity: 0.71 },
  ], { minScore: 0.6, margin: 0.02 });
  assert.deepEqual(ranked, []);
});

test("rankProductsV2 boosts a close visual hit only when text matches clearly", () => {
  const base = { availability: 1, category: "Đồ gia dụng", color: "đỏ", description: "" };
  const ranked = rankProductsV2([
    { ...base, id: 1, name: "Cốc sứ cà phê", similarity: 0.58 },
    { ...base, id: 2, name: "Bàn gỗ", similarity: 0.57 },
  ], { ocrText: "cốc cà phê", minScore: 0.6, margin: 0 });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, 1);
  assert.ok(ranked[0].boosts.includes("text:coc"));
});

test("buildQueryVariants creates original, tight and padded views", async () => {
  const input = await sharp({
    create: {
      width: 200,
      height: 160,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  }).jpeg().toBuffer();
  const variants = await buildQueryVariants(input);
  assert.deepEqual(variants.map((variant) => variant.label), ["original", "tight", "padded"]);
  assert.ok(variants.every((variant) => variant.buffer.length > 0));
});

test("validateAffiliateTarget: chặn open redirect và domain lạ", () => {
  assert.equal(validateAffiliateTarget("https://shopee.vn/search?keyword=ao").ok, true);
  assert.equal(validateAffiliateTarget("https://evil.example.com/phish").ok, false);
  assert.equal(validateAffiliateTarget("javascript:alert(1)").ok, false);
  assert.equal(validateAffiliateTarget("https://shopee.vn.evil.com/").ok, false);
  assert.equal(validateAffiliateTarget("không phải url").ok, false);
  assert.equal(validateAffiliateTarget("https://lazada.vn/products/1").ok, true);
});

test("mapRegionToVideoPixels: crop đúng khi video letterbox (16:9 trong khung 4:3)", () => {
  // container 800x600 (4:3), video 1280x720 (16:9) -> video hiển thị 800x450, letterbox 75px trên/dưới
  const crop = mapRegionToVideoPixels({
    rect: { x: 0, y: 75, w: 400, h: 225 },
    containerWidth: 800, containerHeight: 600,
    videoWidth: 1280, videoHeight: 720,
  });
  assert.deepEqual(crop, { x: 0, y: 0, width: 640, height: 360 });
});

test("mapRegionToVideoPixels: vùng chọn ngoài vùng video bị kẹp vào biên", () => {
  const crop = mapRegionToVideoPixels({
    rect: { x: 0, y: 0, w: 400, h: 100 }, // 100px đầu là letterbox đen
    containerWidth: 800, containerHeight: 600,
    videoWidth: 1280, videoHeight: 720,
  });
  assert.equal(crop.y, 0);
  assert.ok(crop.height >= 0);
});

test("mapRegionToVideoPixels: trả null khi thiếu kích thước", () => {
  assert.equal(mapRegionToVideoPixels({ rect: { x: 0, y: 0, w: 1, h: 1 }, containerWidth: 0, containerHeight: 0, videoWidth: 0, videoHeight: 0 }), null);
});
