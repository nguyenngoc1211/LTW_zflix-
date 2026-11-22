import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db";
process.env.VISION_PROVIDER = "none";

const { parseDeepseekResponse } = await import("../src/modules/shopping/vision.js");

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
  assert.deepEqual(
    parseDeepseekResponse({ choices: [{ message: { content: '{"keyword":"màn hình Dell","category":"không xác định","color":"unknown"}' } }] }),
    { keyword: "màn hình Dell", category: null, color: null },
  );
});
