import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { rankProducts, validateAffiliateTarget } = await import("../src/modules/visual-shopping/ranking.js");
const { mapRegionToVideoPixels } = await import("../../frontend/src/utils/cropMath.js");

test("rankProducts: sắp xếp theo similarity và lọc sản phẩm hết hàng", () => {
  process.env.VISUAL_SIM_THRESHOLD = "0.4";
  const candidates = [
    { id: 1, similarity: 0.7, availability: 1 },
    { id: 2, similarity: 0.9, availability: 0 },
    { id: 3, similarity: 0.8, availability: 1 },
  ];
  const ranked = rankProducts(candidates, {}, 10);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 3);
  assert.equal(ranked[1].id, 1);
});

test("rankProducts: category/color match được boost nhẹ, giới hạn limit", () => {
  process.env.VISUAL_SIM_THRESHOLD = "0.4";
  const candidates = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1, similarity: 0.5 + (i % 10) / 100, availability: 1,
    category: i === 4 ? "fashion" : "other",
    color: i === 4 ? "beige" : "black",
  }));
  const ranked = rankProducts(candidates, { category: "fashion", color: "beige" }, 10);
  assert.equal(ranked.length, 10);
  assert.equal(ranked[0].id, 5); // boost 0.1 đưa lên đầu
  assert.ok(ranked[0].boosts.includes("category") && ranked[0].boosts.includes("color"));
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
