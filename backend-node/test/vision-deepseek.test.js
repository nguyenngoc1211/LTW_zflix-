import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.VISION_PROVIDER = "deepseek";
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.DEEPSEEK_MODEL = "deepseek-v4-flash-vision-exp";
process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.test";

const { identifyProduct, visionConfigured, visionProviderName } = await import(
  "../src/modules/shopping/vision.js"
);

test("DeepSeek: provider được nhận là đã cấu hình", () => {
  assert.equal(visionConfigured(), true);
  assert.equal(visionProviderName(), "deepseek");
});

test("DeepSeek: gửi ảnh base64 đúng chuẩn chat completions", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"keyword":"tai nghe bluetooth","category":"Điện tử","color":"đen"}' } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    const result = await identifyProduct("ZmFrZS1pbWFnZQ==");
    assert.deepEqual(result, {
      keyword: "tai nghe bluetooth",
      category: "Điện tử",
      color: "đen",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.deepseek.test/chat/completions");
    assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");

    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, "deepseek-v4-flash-vision-exp");
    assert.equal(body.max_tokens, 800);
    assert.equal(body.messages[1].content[1].image_url.url, "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==");
  } finally {
    global.fetch = originalFetch;
  }
});

test("DeepSeek: lỗi HTTP trả null để fallback CLIP/OCR", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response("bad request", { status: 400 });

  try {
    assert.equal(await identifyProduct("ZmFrZQ=="), null);
  } finally {
    global.fetch = originalFetch;
  }
});
