// Nạp catalog từ CSV -> tải ảnh -> CLIP embed -> lưu MongoDB -> rebuild HNSW index.
// Chạy: npm run catalog:index
import fs from "node:fs";
import "dotenv/config";
import { parseCsvLine } from "../src/modules/visual-shopping/csv.js";
import { clipReady, embedImage } from "../src/modules/visual-shopping/clip.service.js";
import { rebuildIndex } from "../src/modules/visual-shopping/vector.index.js";
import { mongoCollection, closeMongo } from "../src/core/database/mongo.js";
import { imageUrlsFor, insertCatalogProduct } from "../src/modules/visual-shopping/catalog-import.js";

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
  const imageUrls = imageUrlsFor(record);
  if (!record.name || imageUrls.length === 0) continue;
  try {
    const products = await mongoCollection('visual_products');
    const existing = await products.findOne({ name: record.name }, {
      projection: { id: 1, image_url: 1, image_urls: 1, embedding: 1, embedding_variants: 1 },
    });
    const primaryReady = (() => {
      try {
        const value = typeof existing?.embedding === 'string'
          ? JSON.parse(existing.embedding) : existing?.embedding;
        return Array.isArray(value) && value.length > 0;
      } catch { return false; }
    })();
    const embeddedUrls = new Set([
      ...(existing?.embedding_variants || []).map((item) => item.image_url).filter(Boolean),
      ...(primaryReady && existing?.image_url ? [existing.image_url] : []),
    ]);
    const storedVectorCount = (primaryReady ? 1 : 0) + (existing?.embedding_variants?.length || 0);
    const remainingSlots = Math.max(0, 5 - storedVectorCount);
    const pendingUrls = imageUrls.filter((url) => !embeddedUrls.has(url)).slice(0, remainingSlots);
    if (!pendingUrls.length) { skipped += 1; continue; }

    const embeddings = [];
    for (const imageUrl of pendingUrls) {
      try {
        const response = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`ảnh ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const { embedding, embedMs } = await embedImage(buffer);
        embeddings.push({ imageUrl, embedding, embedMs });
      } catch (error) {
        skipped += 1;
        console.log(`✗ ${record.name}: ${error.message.slice(0, 80)}`);
      }
    }
    if (!embeddings.length) continue;

    const successfulRecord = { ...record, image_urls: embeddings.map((item) => item.imageUrl) };
    const [primary] = embeddings;
    const changed = await insertCatalogProduct(
      successfulRecord,
      primary.embedding,
      embeddings.map(({ imageUrl, embedding }) => ({ imageUrl, embedding })),
    );
    if (!changed) { skipped += embeddings.length; continue; }
    done += embeddings.length;
    console.log(`✓ ${record.name}: ${embeddings.length} ảnh, ${embeddings.map((item) => item.embedMs).join('/')}ms`);
  } catch (e) {
    console.log(`✗ ${record.name || "?"}: ${e.message.slice(0, 80)}`);
    skipped += 1;
  }
}

await rebuildIndex();
const products = await mongoCollection('visual_products');
const catalog = await products.find({ availability: 1,
  $or: [{ embedding: { $ne: null } }, { "embedding_variants.0": { $exists: true } }] },
{ projection: { embedding_variants: 1 } }).toArray();
const vectorCount = catalog.reduce((sum, product) => sum + 1 + (product.embedding_variants?.length || 0), 0);
console.log(`\n=> ${done} ảnh được embed, ${skipped} ảnh bỏ qua, ${catalog.length} sản phẩm có vector / ${vectorCount} vector. HNSW đã rebuild.`);
await closeMongo();
process.exit(0);
