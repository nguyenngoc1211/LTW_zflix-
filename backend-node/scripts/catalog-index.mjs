// Nạp catalog từ CSV -> tải ảnh -> CLIP embed -> lưu MongoDB -> rebuild HNSW index.
// Chạy: npm run catalog:index
import fs from "node:fs";
import "dotenv/config";
import { parseCsvLine } from "../src/modules/visual-shopping/csv.js";
import { clipReady, embedImage } from "../src/modules/visual-shopping/clip.service.js";
import { rebuildIndex } from "../src/modules/visual-shopping/vector.index.js";
import { mongoCollection, closeMongo } from "../src/core/database/mongo.js";
import { insertCatalogProduct } from "../src/modules/visual-shopping/catalog-import.js";

const csvPath = process.argv[2] || "data/products.sample.csv";
if (!fs.existsSync(csvPath)) {
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
    const products = await mongoCollection('visual_products');
    if (await products.findOne({ name: record.name }, { projection: { _id: 1 } })) { skipped += 1; continue; }
    const res = await fetch(record.image_url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`ảnh ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const { embedding, embedMs } = await embedImage(buffer);
    if (!await insertCatalogProduct(record, embedding)) { skipped += 1; continue; }
    done += 1;
    console.log(`✓ [${embedMs}ms] ${record.name}`);
  } catch (e) {
    console.log(`✗ ${record.name || "?"}: ${e.message.slice(0, 80)}`);
    skipped += 1;
  }
}

await rebuildIndex();
const count = await (await mongoCollection('visual_products')).countDocuments({ embedding: { $ne: null } });
console.log(`\n=> ${done} nạp mới, ${skipped} bỏ qua, tổng ${count} sản phẩm có embedding. HNSW đã rebuild.`);
await closeMongo();
process.exit(0);
