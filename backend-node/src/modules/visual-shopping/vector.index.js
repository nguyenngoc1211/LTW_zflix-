// Vector index HNSW in-process (hnswlib-node native).
// Embeddings của catalog được lưu dạng JSON trong database đang chọn và build lại index
// khi boot — không tạo lại embedding trong mỗi request.
// Nếu native HNSW không khả dụng, tìm cosine chính xác trên catalog trong bộ nhớ.

import { pool } from "../../core/database/pool.js";
import { mongoCollection } from "../../core/database/mongo.js";

let indexPromise = null;
let catalogSize = 0;
let vectorCount = 0;
let lastBuildMs = null;
let exactItems = null;
let productIdByPoint = [];

const parseEmbedding = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) && parsed.every(Number.isFinite) ? parsed : null;
  } catch { return null; }
};

export const productEmbeddings = (row) => {
  const primary = parseEmbedding(row.embedding);
  const variants = Array.isArray(row.embedding_variants)
    ? row.embedding_variants.map((item) => parseEmbedding(item?.embedding)).filter(Boolean)
    : [];
  const seen = new Set();
  return [primary, ...variants].filter((embedding) => {
    if (!embedding) return false;
    const key = embedding.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const collapseProductHits = (hits) => {
  const bestPerProduct = new Map();
  for (const hit of hits) {
    if (!Number.isFinite(hit?.similarity) || hit.productId === undefined || hit.productId === null) continue;
    const previous = bestPerProduct.get(hit.productId);
    if (!previous || hit.similarity > previous.similarity) {
      bestPerProduct.set(hit.productId, { productId: hit.productId, similarity: hit.similarity });
    }
  }
  return [...bestPerProduct.values()].sort((a, b) => b.similarity - a.similarity);
};

const cosine = (a, b) => {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  return aNorm && bNorm ? dot / Math.sqrt(aNorm * bNorm) : 0;
};

const buildIndex = async () => {
  const t0 = Date.now();
  const rows = process.env.DATA_STORE === "mongodb"
    ? await (await mongoCollection("visual_products")).find({ availability: 1,
      $or: [{ embedding: { $ne: null } }, { "embedding_variants.0": { $exists: true } }] },
    { projection: { id: 1, embedding: 1, embedding_variants: 1 } }).toArray()
    : (await pool.query(
      "SELECT id, embedding FROM visual_products WHERE availability = 1 AND embedding IS NOT NULL",
    ))[0];
  const items = rows.flatMap((row) => productEmbeddings(row)
    .map((embedding, viewIndex) => ({ id: row.id, embedding, viewIndex })));
  exactItems = items;
  productIdByPoint = items.map((item) => item.id);
  let index = null;
  try {
    const { default: hnswlib } = await import("hnswlib-node");
    index = new hnswlib.HierarchicalNSW("cosine", items[0]?.embedding.length || 512);
    index.initIndex({ maxElements: Math.max(1000, items.length * 2) });
    items.forEach((item, pointId) => index.addPoint(item.embedding, pointId));
  } catch (error) {
    console.warn(`[VectorIndex] HNSW không khả dụng, dùng cosine JS: ${error.message.split("\n")[0]}`);
  }
  catalogSize = new Set(items.map((item) => item.id)).size;
  vectorCount = items.length;
  lastBuildMs = Date.now() - t0;
  console.log(`[VectorIndex] dựng lại ${catalogSize} sản phẩm / ${vectorCount} ảnh trong ${lastBuildMs}ms`);
  return index;
};

const getIndex = async () => {
  if (!indexPromise) {
    indexPromise = buildIndex();
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
};

// Gọi sau khi import/thay đổi catalog (script catalog-index hoặc API import)
export const rebuildIndex = async () => {
  indexPromise = buildIndex();
  return indexPromise;
};

export const indexStats = async () => {
  await getIndex();
  return { catalogSize, vectorCount, lastBuildMs };
};

// Tìm top-K vector gần nhất
export const searchByVector = async (embedding, k = 20) => {
  let index = await getIndex();
  // Auto-heal: index trống nhưng DB có embedding (boot lúc DB trống / import sau boot)
  if (catalogSize === 0) {
    const count = process.env.DATA_STORE === "mongodb"
      ? await (await mongoCollection("visual_products")).countDocuments({ availability: 1,
        $or: [{ embedding: { $ne: null } }, { "embedding_variants.0": { $exists: true } }] })
      : (await pool.query("SELECT COUNT(*) AS n FROM visual_products WHERE availability = 1 AND embedding IS NOT NULL"))[0][0].n;
    if (count > 0) {
      console.log(`[VectorIndex] index trống nhưng DB có ${count} sản phẩm — rebuild tự động`);
      index = await rebuildIndex();
    }
  }
  if (catalogSize === 0) return { items: [], searchMs: 0 };
  const t0 = Date.now();
  const hits = [];
  if (!index) {
    for (const item of exactItems) {
      if (item.embedding.length !== embedding.length) continue;
      const similarity = cosine(embedding, item.embedding);
      hits.push({ productId: item.id, similarity });
    }
  } else {
    // A product can contribute up to five vectors (primary + four views).
    // Over-fetch enough neighbors so collapsing views is less likely to leave
    // the requested product result count short.
    const variantHits = Math.min(vectorCount, Math.max(k * 5, 50));
    const results = await index.searchKnn(embedding, variantHits);
    for (let position = 0; position < results.neighbors.length; position += 1) {
      const productId = productIdByPoint[results.neighbors[position]];
      if (productId === undefined) continue;
      const similarity = 1 - results.distances[position];
      hits.push({ productId, similarity });
    }
  }
  const bestPerProduct = collapseProductHits(hits);
  const searchMs = Date.now() - t0;
  return {
    items: bestPerProduct
      .map((item) => ({ ...item, similarity: Number(item.similarity.toFixed(4)) }))
      .slice(0, k),
    searchMs,
  };
};
