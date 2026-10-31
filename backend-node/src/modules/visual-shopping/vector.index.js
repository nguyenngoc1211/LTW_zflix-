// Vector index HNSW in-process (hnswlib-node native).
// Embeddings của catalog được lưu dạng JSON trong database đang chọn và build lại index
// khi boot — không tạo lại embedding trong mỗi request.
// Nếu native HNSW không khả dụng, tìm cosine chính xác trên catalog trong bộ nhớ.

import { pool } from "../../core/database/pool.js";
import { mongoCollection } from "../../core/database/mongo.js";

let indexPromise = null;
let catalogSize = 0;
let lastBuildMs = null;
let exactItems = null;

const parseEmbedding = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) && parsed.every(Number.isFinite) ? parsed : null;
  } catch { return null; }
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
      embedding: { $ne: null } }, { projection: { id: 1, embedding: 1 } }).toArray()
    : (await pool.query(
      "SELECT id, embedding FROM visual_products WHERE availability = 1 AND embedding IS NOT NULL",
    ))[0];
  const items = rows
    .map((row) => {
      const embedding = parseEmbedding(row.embedding);
      return embedding ? { id: row.id, embedding } : null;
    })
    .filter(Boolean);
  exactItems = items;
  let index = null;
  try {
    const { default: hnswlib } = await import("hnswlib-node");
    index = new hnswlib.HierarchicalNSW("cosine", items[0]?.embedding.length || 512);
    index.initIndex({ maxElements: Math.max(1000, items.length * 2) });
    for (const item of items) index.addPoint(item.embedding, item.id);
  } catch (error) {
    console.warn(`[VectorIndex] HNSW không khả dụng, dùng cosine JS: ${error.message.split("\n")[0]}`);
  }
  catalogSize = items.length;
  lastBuildMs = Date.now() - t0;
  console.log(`[VectorIndex] dựng lại ${items.length} sản phẩm trong ${lastBuildMs}ms`);
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
  return { catalogSize, lastBuildMs };
};

// Tìm top-K vector gần nhất
export const searchByVector = async (embedding, k = 20) => {
  let index = await getIndex();
  // Auto-heal: index trống nhưng DB có embedding (boot lúc DB trống / import sau boot)
  if (catalogSize === 0) {
    const count = process.env.DATA_STORE === "mongodb"
      ? await (await mongoCollection("visual_products")).countDocuments({ availability: 1,
        embedding: { $ne: null } })
      : (await pool.query("SELECT COUNT(*) AS n FROM visual_products WHERE availability = 1 AND embedding IS NOT NULL"))[0][0].n;
    if (count > 0) {
      console.log(`[VectorIndex] index trống nhưng DB có ${count} sản phẩm — rebuild tự động`);
      index = await rebuildIndex();
    }
  }
  if (catalogSize === 0) return { items: [], searchMs: 0 };
  const t0 = Date.now();
  if (!index) {
    const items = exactItems.filter((item) => item.embedding.length === embedding.length)
      .map((item) => ({ productId: item.id, similarity: Number(cosine(embedding, item.embedding).toFixed(4)) }))
      .sort((a, b) => b.similarity - a.similarity).slice(0, k);
    return { items, searchMs: Date.now() - t0 };
  }
  const results = await index.searchKnn(embedding, Math.min(k, catalogSize));
  const searchMs = Date.now() - t0;
  // hnswlib cosine distance = 1 - cosine similarity
  return {
    items: results.neighbors.map((id, position) => ({
      productId: id,
      similarity: Number((1 - results.distances[position]).toFixed(4)),
    })),
    searchMs,
  };
};
