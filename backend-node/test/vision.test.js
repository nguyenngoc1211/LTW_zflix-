import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db";
process.env.VISION_PROVIDER = "none";

const { parseGeminiResponse, parseDeepseekResponse } = await import("../src/modules/shopping/vision.js");

test("parseGeminiResponse đọc JSON thuần từ Gemini", () => {
  const json = {
    candidates: [{ content: { parts: [{ text: '{"keyword":"đồng hồ đeo tay nam dây thép","category":"Phụ kiện"}' }] } }],
  };
  assert.deepEqual(parseGeminiResponse(json), {
    keyword: "đồng hồ đeo tay nam dây thép",
    category: "Phụ kiện",
    color: null,
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

test("parseDeepseekResponse đọc JSON từ chat completions", () => {
  const json = {
    choices: [{ message: { content: '{"keyword":"tai nghe bluetooth","category":"Điện tử","color":"đen"}' } }],
  };
  assert.deepEqual(parseDeepseekResponse(json), {
    keyword: "tai nghe bluetooth",
    category: "Điện tử",
    color: "đen",
  });
});

test("parseDeepseekResponse xử lý markdown fence", () => {
  const json = {
    choices: [{ message: { content: '```json\n{"keyword":"giày sneaker nam","category":"Thời trang"}\n```' } }],
  };
  assert.deepEqual(parseDeepseekResponse(json), {
    keyword: "giày sneaker nam",
    category: "Thời trang",
    color: null,
  });
});

test("parseDeepseekResponse trả null khi rỗng hoặc không có keyword", () => {
  assert.equal(parseDeepseekResponse({}), null);
  assert.equal(parseDeepseekResponse({ choices: [{ message: { content: '{"category":"x"}' } }] }), null);
});

test("parser loại từ khoá vô nghĩa khi vùng quét không có món đồ rõ ràng", () => {
  assert.equal(
    parseDeepseekResponse({ choices: [{ message: { content: '{"keyword":"không xác định","category":"Điện tử"}' } }] }),
    null,
  );
  assert.equal(
    parseGeminiResponse({ candidates: [{ content: { parts: [{ text: "unknown" }] } }] }),
    null,
  );
  assert.deepEqual(
    parseDeepseekResponse({ choices: [{ message: { content: '{"keyword":"màn hình Dell","category":"không xác định","color":"unknown"}' } }] }),
    { keyword: "màn hình Dell", category: null, color: null },
  );
});
