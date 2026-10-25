// Nạp catalog từ CSV -> tải ảnh -> CLIP embed -> lưu MySQL -> rebuild HNSW index.
// Chạy: npm run catalog:index
import fs from "node:fs";
import "dotenv/config";
import { parseCsvLine } from "../src/modules/visual-shopping/csv.js";
import { clipReady, embedImage } from "../src/modules/visual-shopping/clip.service.js";
import { rebuildIndex } from "../src/modules/visual-shopping/vector.index.js";
import { pool } from "../src/core/database/pool.js";

const csvPath = process.argv[2] || "data/products.sample.csv";
if (!process.env.OMDB_API_KEY && !fs.existsSync(csvPath)) {
  console.error("❌ Thiếu file catalog CSV:", csvPath);
  process.exit(1);
}

await clipReady();
const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

let done = 0;
let skipped = 0;
for (const line of lines.slice(1)) {
  const cols = parseCsvLine(line);
  const record = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
  if (!record.name || !record.image_url) continue;
  try {
    // Trùng slug tên -> bỏ qua (idempotent)
    const [dup] = await pool.execute("SELECT id FROM visual_products WHERE name = ? LIMIT 1", [record.name]);
    if (dup.length) { skipped += 1; continue; }
    const res = await fetch(record.image_url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`ảnh ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const { embedding, embedMs } = await embedImage(buffer);
    await pool.execute(
      `INSERT INTO visual_products (name, description, category, color, price, currency, marketplace, product_url, affiliate_url, image_url, availability, embedding, embedded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())`,
      [record.name, record.description || null, record.category || null, record.color || null,
       Number(record.price) || null, record.currency || "VND", record.marketplace || "catalog",
       record.product_url || null, record.affiliate_url || null, record.image_url, JSON.stringify(embedding)],
    );
    done += 1;
    console.log(`✓ [${embedMs}ms] ${record.name}`);
  } catch (e) {
    console.log(`✗ ${record.name || "?"}: ${e.message.slice(0, 80)}`);
    skipped += 1;
  }
}

await rebuildIndex();
const { pool: _p } = { pool };
const [count] = await pool.execute("SELECT COUNT(*) AS n FROM visual_products WHERE embedding IS NOT NULL");
console.log(`\n=> ${done} nạp mới, ${skipped} bỏ qua, tổng ${count[0].n} sản phẩm có embedding. HNSW đã rebuild.`);
await pool.end();
process.exit(0);
