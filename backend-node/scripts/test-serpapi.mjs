// Test SerpAPI Google Lens với ảnh công khai — chạy: npm run test:serpapi
// Đầu tiên dán key vào backend-node/.env:  SERPAPI_KEY=...   (lấy tại serpapi.com)

import "dotenv/config";

const key = process.env.SERPAPI_KEY?.trim();
if (!key) {
  console.error("❌ Chưa có SERPAPI_KEY trong backend-node/.env");
  console.log("   1. Vào https://serpapi.com → Sign up (miễn phí 100 lượt tìm/tháng)");
  console.log("   2. Sau đăng nhập, vào https://serpapi.com/manage-api-key");
  console.log('   3. Copy key rồi thêm dòng:  SERPAPI_KEY=<key của bạn>');
  console.log("   4. Chạy lại:  npm run test:serpapi");
  process.exit(1);
}

// Ảnh công khai mẫu (Wikimedia, đã curl xác minh HTTP 200)
const testImage =
  "https://upload.wikimedia.org/wikipedia/commons/6/6e/Golde33443.jpg";

console.log("Đang gọi SerpAPI Google Lens...");
const t0 = Date.now();
const params = new URLSearchParams({ engine: "google_lens", url: testImage, api_key: key });
const response = await fetch(`https://serpapi.com/search.json?${params}`, {
  signal: AbortSignal.timeout(30000),
});
const ms = ((Date.now() - t0) / 1000).toFixed(1);

if (!response.ok) {
  const text = await response.text();
  console.error(`❌ HTTP ${response.status} (${ms}s):`, text.slice(0, 300));
  if (response.status === 401) console.log("   → Key sai hoặc chưa kích hoạt. Kiểm tra lại https://serpapi.com/manage-api-key");
  if (response.status === 429) console.log("   → Hết quota free (100 lượt/tháng).");
  process.exit(1);
}

const json = await response.json();
const matches = json.visual_matches || [];
console.log(`✓ HTTP 200 sau ${ms} giây`);
console.log(`✓ Google Lens trả về ${matches.length} kết quả visual match`);
console.log("\n3 kết quả đầu (đúng format hệ thống sẽ parse):");
for (const match of matches.slice(0, 3)) {
  console.log(`  - ${match.title || "(không tên)"}`);
  console.log(`    nguồn: ${match.source?.name || "?"} | link: ${(match.link || "").slice(0, 60)}`);
}

console.log("\n>>> SerpAPI HOẠT ĐỘNG. Hệ thống sẽ lấy match[0].title làm từ khóa tìm Shopee.");
console.log(">>> Lưu ý: SerpAPI cần URL ảnh công khai — dùng được khi deploy có domain");
console.log("    (điền PUBLIC_BASE_URL=https://domain-của-bạn). Local dev dùng Gemini (base64).");
