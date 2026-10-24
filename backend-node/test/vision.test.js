import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db";
process.env.VISION_PROVIDER = "none";

const { parseGeminiResponse } = await import("../src/modules/shopping/vision.js");

test("parseGeminiResponse đọc JSON thuần từ Gemini", () => {
  const json = {
    candidates: [{ content: { parts: [{ text: '{"keyword":"đồng hồ đeo tay nam dây thép","category":"Phụ kiện"}' }] } }],
  };
  assert.deepEqual(parseGeminiResponse(json), {
    keyword: "đồng hồ đeo tay nam dây thép",
    category: "Phụ kiện",
  });
});

test("parseGeminiResponse xử lý markdown fence và text thừa", () => {
  const json = {
    candidates: [{ content: { parts: [{ text: '```json\n{"keyword":"áo khoác da nam","category":"Thời trang"}\n```' }] } }],
  };
  assert.equal(parseGeminiResponse(json).keyword, "áo khoác da nam");
});

test("parseGeminiResponse fallback dùng text ngắn khi không parse được JSON", () => {
  const json = { candidates: [{ content: { parts: [{ text: "mũ lưỡi trai" }] } }] };
  assert.equal(parseGeminiResponse(json).keyword, "mũ lưỡi trai");
});

test("parseGeminiResponse trả null khi rỗng hoặc không có keyword", () => {
  assert.equal(parseGeminiResponse({}), null);
  assert.equal(parseGeminiResponse({ candidates: [{ content: { parts: [{ text: '{"category":"x"}' }] } }] }), null);
});
