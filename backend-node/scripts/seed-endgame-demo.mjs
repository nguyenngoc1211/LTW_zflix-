// Seed a local-only Endgame demo catalog from reference frames.
// Usage:
//   node scripts/seed-endgame-demo.mjs --fixture <dir> [--reset]
// <dir>/products.json must contain:
//   [{ object, name, category, color, description, ref, queries: [] }]
// The script writes <dir>/manifest.json for benchmark-visual-v2.mjs.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { mongoCollection, closeMongo } from "../src/core/database/mongo.js";
import { clipReady, embedImage } from "../src/modules/visual-shopping/clip.service.js";
import { insertCatalogProduct } from "../src/modules/visual-shopping/catalog-import.js";
import { rebuildIndex } from "../src/modules/visual-shopping/vector.index.js";

const argv = process.argv.slice(2);
const fixtureIndex = argv.indexOf("--fixture");
const fixtureDir = fixtureIndex >= 0
  ? path.resolve(argv[fixtureIndex + 1])
  : path.join(process.env.LOCALAPPDATA || process.env.TEMP || ".", "Temp", "opencode", "endgame-demo");
const reset = argv.includes("--reset");

if (!fs.existsSync(path.join(fixtureDir, "products.json"))) {
  throw new Error(`Không thấy ${path.join(fixtureDir, "products.json")}`);
}

const products = JSON.parse(fs.readFileSync(path.join(fixtureDir, "products.json"), "utf8"));
const visualProducts = await mongoCollection("visual_products");

if (reset) {
  const removed = await visualProducts.deleteMany({ demo: true, demo_source: "endgame" });
  console.log(`Đã xóa ${removed.deletedCount} sản phẩm demo cũ.`);
}

await clipReady();
const manifest = [];

for (const product of products) {
  const refPath = path.join(fixtureDir, product.ref);
  if (!fs.existsSync(refPath)) {
    console.log(`[skip] ${product.name}: không thấy ${product.ref}`);
    continue;
  }

  const source = await sharp(fs.readFileSync(refPath)).jpeg({ quality: 92 }).toBuffer();
  const dataUrl = `data:image/jpeg;base64,${source.toString("base64")}`;
  const { embedding } = await embedImage(source);

  const extraRefs = [];
  for (const extraRef of product.extra_refs || []) {
    const extraPath = path.join(fixtureDir, extraRef);
    if (!fs.existsSync(extraPath)) {
      console.log(`[skip extra] ${product.name}: không thấy ${extraRef}`);
      continue;
    }
    const extraBuffer = await sharp(fs.readFileSync(extraPath)).jpeg({ quality: 92 }).toBuffer();
    const extraDataUrl = `data:image/jpeg;base64,${extraBuffer.toString("base64")}`;
    const { embedding: extraEmbedding } = await embedImage(extraBuffer);
    extraRefs.push({ dataUrl: extraDataUrl, embedding: extraEmbedding });
  }

  const record = {
    name: product.name,
    description: product.description || null,
    category: product.category || null,
    color: product.color || null,
    price: null,
    currency: "VND",
    marketplace: "catalog",
    product_url: null,
    affiliate_url: null,
    image_url: dataUrl,
    image_urls: [dataUrl, ...extraRefs.map((item) => item.dataUrl)],
  };

  const inserted = await insertCatalogProduct(
    record,
    embedding,
    extraRefs.map((item) => ({ imageUrl: item.dataUrl, embedding: item.embedding })),
  );
  const row = await visualProducts.findOne({ name: product.name }, { projection: { id: 1 } });
  if (!row) {
    console.log(`[skip] ${product.name}: không tạo được bản ghi`);
    continue;
  }

  await visualProducts.updateOne({ id: row.id }, {
    $set: {
      demo: true,
      demo_source: "endgame",
      demo_object: product.object,
      updated_at: new Date(),
    },
  });

  const queries = (product.queries || []).filter((file) =>
    fs.existsSync(path.join(fixtureDir, file)));
  manifest.push({
    object: product.object,
    name: product.name,
    productId: row.id,
    images: queries,
  });
  console.log(`${inserted ? "✓" : "="} #${row.id} ${product.name} (${queries.length} query, ${1 + extraRefs.length} ref)`);
}

fs.writeFileSync(path.join(fixtureDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await rebuildIndex();
console.log(`\nManifest: ${path.join(fixtureDir, "manifest.json")}`);
console.log(`Đã seed ${manifest.length} sản phẩm demo.`);
await closeMongo();
