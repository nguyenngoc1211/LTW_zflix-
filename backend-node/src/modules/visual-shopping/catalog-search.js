import { searchByVectors } from "./vector.index.js";

export const exactMaxVectors = () =>
  Number(process.env.VISUAL_EXACT_MAX_VECTORS || 10000);

export const top1MinScore = () =>
  Number(process.env.VISUAL_TOP1_MIN_SCORE) ||
  Number(process.env.VISUAL_SIM_THRESHOLD) ||
  0.6;

// V2 tries the original crop first. Extra query views are only used when the
// original crop is below the confidence threshold. This avoids a tight/padded
// view overriding a confident original with a different product.
export const searchCatalogVectors = async (embeddings, { k = 20 } = {}) => {
  const queries = (Array.isArray(embeddings) ? embeddings : [embeddings]).filter(Boolean);
  if (!queries.length) return { hits: [], searchMs: 0 };

  const options = { preferExactMaxVectors: exactMaxVectors() };
  const primary = await searchByVectors([queries[0]], k, options);
  let hits = primary.items;
  let searchMs = primary.searchMs;

  if (queries.length > 1 && (hits[0]?.similarity ?? 0) < top1MinScore()) {
    const all = await searchByVectors(queries, k, options);
    hits = all.items;
    searchMs += all.searchMs;
  }

  return { hits, searchMs };
};
