// Vector index HNSW in-process (hnswlib-node native).
// Embeddings của toàn bộ catalog được lưu trong MySQL (JSON) và build lại index
// khi boot — không tạo lại embedding trong mỗi request.
// Ghi chú kiến trúc: cùng thuật toán HNSW như pgvector; chọn in-process vì
// dự án chạy MySQL hiện tại — khi chuyển PostgreSQL, đổi sang pgvector với
// cùng interface (searchByVector) mà không đổi tầng trên.

import { pool } from "../../core/database/pool.js";
import { embedImage } from "./clip.service.js";

let indexPromise = null;
let catalogSize = 0;
let lastBuildMs = null;

const buildIndex = async () => {
  const t0 = Date.now();
  const { default: hnswlib } = await import("hnswlib-node");
  const [rows] = await pool.query(
    "SELECT id, embedding FROM visual_products WHERE availability = 1 AND embedding IS NOT NULL",
  );
  const items = rows
    .map((row) => {
      try {
        return { id: row.id, embedding: JSON.parse(row.embedding) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const index = new hnswlib.HierarchicalNSW("cosine", items[0]?.embedding.length || 512);
  index.initIndex({ maxElements: Math.max(1000, items.length * 2) });
  // addPoint từng item (API của hnswlib-node không có addPoints)
  for (const item of items) {
    index.addPoint(item.embedding, item.id);
  }
  catalogSize = items.length;
  lastBuildMs = Date.now() - t0;
  console.log(`[VectorIndex] HNSW dựng lại ${items.length} sản phẩm trong ${lastBuildMs}ms`);
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
    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS n FROM visual_products WHERE availability = 1 AND embedding IS NOT NULL",
    );
    if (countRows[0].n > 0) {
      console.log(`[VectorIndex] index trống nhưng DB có ${countRows[0].n} sản phẩm — rebuild tự động`);
      index = await rebuildIndex();
    }
  }
  if (catalogSize === 0) return [];
  const t0 = Date.now();
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
