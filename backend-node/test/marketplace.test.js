import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "mysql://root:rootpassword@127.0.0.1:3306/movie_streaming_db";

const { searchMarketplace } = await import("../src/modules/visual-shopping/marketplace.js");

const sampleResponse = {
  data: [
    {
      id: 123,
      name: "Màn hình Dell 24 inch",
      url_path: "man-hinh-dell-24-inch-p123.html",
      availability: 1,
      price: 2890000,
      thumbnail_url: "https://salt.tikicdn.com/x.jpg",
      brand_name: "Dell",
      primary_category_name: "Màn hình máy tính",
      rating_average: 4.8,
      review_count: 120,
    },
    { name: "Không có id nên bị loại" },
  ],
};

test("searchMarketplace map sản phẩm Tiki sang shape CineLens", async (t) => {
  let requested = "";
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    requested = String(url);
    return { ok: true, json: async () => sampleResponse };
  };
  t.after(() => { global.fetch = originalFetch; });

  const items = await searchMarketplace("man hinh dell 24", 5);

  assert.equal(items.length, 1);
  assert.equal(items[0].id, "tiki-123");
  assert.equal(items[0].name, "Màn hình Dell 24 inch");
  assert.equal(items[0].platform, "Tiki");
  assert.equal(items[0].price, 2890000);
  assert.equal(items[0].currency, "VND");
  assert.equal(items[0].productUrl, "https://tiki.vn/man-hinh-dell-24-inch-p123.html");
  assert.equal(items[0].availability, true);
  assert.equal(items[0].hasAffiliate, false);
  assert.match(requested, /[?&]q=man\+hinh\+dell\+24/);
});

test("searchMarketplace dùng cache cho cùng từ khoá", async (t) => {
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => sampleResponse };
  };
  t.after(() => { global.fetch = originalFetch; });

  await searchMarketplace("tu khoa cache");
  await searchMarketplace("tu khoa cache");
  assert.equal(calls, 1);
});

test("searchMarketplace trả rỗng khi không có từ khoá", async (t) => {
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => { calls += 1; return { ok: true, json: async () => ({}) }; };
  t.after(() => { global.fetch = originalFetch; });

  assert.deepEqual(await searchMarketplace("   "), []);
  assert.equal(calls, 0);
});

test("searchMarketplace ném lỗi khi sàn trả non-2xx", async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(() => searchMarketplace("tu khoa loi 503"), /Tiki 503/);
});
