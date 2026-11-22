// Benchmark Lensy CLIP V2: multi-view query, exact/HNSW search, precision ranking.
//
// Default mode builds transformed queries from catalog images (crop, brightness,
// padding).
// Fixture mode:
//   node scripts/benchmark-visual.mjs --fixture <dir>
// where <dir>/manifest.json is:
//   [{ "object": "cup", "productId": 101, "images": ["cup-1.jpg", "cup-2.jpg"] }]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { mongoCollection, closeMongo } from "../src/core/database/mongo.js";
import { clipReady, embedImage } from "../src/modules/visual-shopping/clip.service.js";
import { searchCatalogVectors } from "../src/modules/visual-shopping/catalog-search.js";
import { rankProductsV2 } from "../src/modules/visual-shopping/ranking.js";
import { buildQueryVariants } from "../src/modules/visual-shopping/query-variants.js";

const argv = process.argv.slice(2);
const fixtureIndex = argv.indexOf("--fixture");
const fixtureDir = fixtureIndex >= 0 ? argv[fixtureIndex + 1] : null;
const limitIndex = argv.indexOf("--limit");
const limit = limitIndex >= 0 ? Math.max(1, Number(argv[limitIndex + 1]) || 0) : 0;

const loadImage = async (url) => {
  if (String(url).startsWith("data:")) {
    return Buffer.from(String(url).split(",")[1] || "", "base64");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`image ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

const transform = async (buffer, type) => {
  const metadata = await sharp(buffer).metadata();
  const width = Number(metadata.width) || 0;
  const height = Number(metadata.height) || 0;
  if (type === "tight") {
    const w = Math.max(32, Math.round(width * 0.8));
    const h = Math.max(32, Math.round(height * 0.8));
    return sharp(buffer).extract({
      left: Math.max(0, Math.round((width - w) / 2)),
      top: Math.max(0, Math.round((height - h) / 2)),
      width: w,
      height: h,
    }).jpeg({ quality: 90 }).toBuffer();
  }
  if (type === "bright") {
    return sharp(buffer).modulate({ brightness: 1.2 }).jpeg({ quality: 90 }).toBuffer();
  }
  if (type === "dark") {
    return sharp(buffer).modulate({ brightness: 0.8 }).jpeg({ quality: 90 }).toBuffer();
  }
  if (type === "padded") {
    const fgWidth = Math.max(32, Math.round(width * 0.82));
    const fgHeight = Math.max(32, Math.round(height * 0.82));
    const background = await sharp(buffer).resize(width, height, { fit: "cover" })
      .blur(18).toBuffer();
    const foreground = await sharp(buffer).resize(fgWidth, fgHeight, { fit: "inside" })
      .toBuffer();
    return sharp(background).composite([{ input: foreground, gravity: "center" }])
      .jpeg({ quality: 90 }).toBuffer();
  }
  return buffer;
};

const rows = await (await mongoCollection("visual_products")).find({
  availability: 1,
  $or: [{ embedding: { $ne: null } }, { "embedding_variants.0": { $exists: true } }],
}, {
  projection: {
    id: 1, name: 1, image_url: 1, image_urls: 1, category: 1, color: 1,
    description: 1, availability: 1,
  },
}).toArray();

const rowById = new Map(rows.map((row) => [row.id, row]));
const catalogFor = (hits) => hits
  .map((hit) => {
    const row = rowById.get(hit.productId);
    return row ? { ...row, similarity: hit.similarity } : null;
  })
  .filter(Boolean);

const bucket = () => ({ count: 0, top1: 0, top5: 0, mrr: 0, ms: 0 });

const collect = (target, ranked, expectedId) => {
  const index = ranked.findIndex((item) => item.id === expectedId);
  target.count += 1;
  if (index === 0) target.top1 += 1;
  if (index >= 0 && index < 5) target.top5 += 1;
  if (index >= 0) target.mrr += 1 / (index + 1);
};

const summarize = (target) => ({
  count: target.count,
  top1: target.count ? `${Math.round((target.top1 / target.count) * 100)}%` : "0%",
  top5: target.count ? `${Math.round((target.top5 / target.count) * 100)}%` : "0%",
  mrr: target.count ? Number((target.mrr / target.count).toFixed(3)) : 0,
  avgMs: target.count ? Math.round(target.ms / target.count) : 0,
});

const runV2 = async (buffer) => {
  const started = Date.now();
  const variants = await buildQueryVariants(buffer);
  const embeddings = [];
  for (const variant of variants) {
    const { embedding } = await embedImage(variant.buffer);
    embeddings.push(embedding);
  }
  const { hits } = await searchCatalogVectors(embeddings);
  const ranked = rankProductsV2(catalogFor(hits), {}, 15);
  return { ranked, ms: Date.now() - started };
};

await clipReady();

if (fixtureDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, "manifest.json"), "utf8"));
  const entries = manifest.filter((entry) => Number.isInteger(entry.productId) && Array.isArray(entry.images));
  const target = bucket();
  const stability = new Map();

  for (const entry of entries) {
    for (const imageName of entry.images) {
      const buffer = fs.readFileSync(path.join(fixtureDir, imageName));
      const { ranked, ms } = await runV2(buffer);
      collect(target, ranked, entry.productId);
      target.ms += ms;
      const top1 = ranked[0]?.id ?? null;
      if (!stability.has(entry.object)) stability.set(entry.object, []);
      stability.get(entry.object).push(top1);
    }
  }

  console.log("\n=== Endgame fixture: CLIP V2 ===");
  console.log(summarize(target));
  for (const [object, ids] of stability) {
    const unique = [...new Set(ids)];
    console.log(`  ${object}: top1=${ids.join(",")} stable=${unique.length === 1 ? "yes" : "no"}`);
  }
} else {
  const sample = limit ? rows.slice(0, limit) : rows;
  const buckets = Object.fromEntries(["identity", "tight", "bright", "dark", "padded"]
    .map((type) => [type, bucket()]));

  for (const [rowIndex, row] of sample.entries()) {
    try {
      const imageUrl = row.image_url || row.image_urls?.[0];
      if (!imageUrl) continue;
      const original = await loadImage(imageUrl);
      for (const type of Object.keys(buckets)) {
        const query = await transform(original, type);
        const { ranked, ms } = await runV2(query);
        collect(buckets[type], ranked, row.id);
        buckets[type].ms += ms;
      }
      console.log(`[${rowIndex + 1}/${sample.length}] ${row.name}`);
    } catch (error) {
      console.log(`[skip] ${row.name}: ${error.message.slice(0, 100)}`);
    }
  }

  console.log("\n=== Synthetic catalog queries: CLIP V2 ===");
  for (const [type, target] of Object.entries(buckets)) {
    console.log(`${type}:`, summarize(target));
  }
}

await closeMongo();
