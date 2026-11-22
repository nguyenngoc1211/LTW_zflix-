// Ranking thuần (pure) — unit test được mà không cần DB/AI.
// Điểm tương đồng chính là cosine similarity từ vector index; category/color
// chỉ dùng như boost nhỏ khi AI trả về thuộc tính, không bịa điểm.

// Ngưỡng tương đồng tối thiểu — dưới ngưỡng coi là "không tìm thấy sản phẩm phù hợp"
// (tunable qua env VISUAL_SIM_THRESHOLD; CLIP cosine ~0.55-0.6 là cùng chủ đề)
export const similarityThreshold = () =>
  Number(process.env.VISUAL_SIM_THRESHOLD || 0.6);

// Ranking V2: precision-first, optional light text boost.
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  "cai", "chiec", "con", "mon", "do", "dung", "vat", "mau", "cua", "va", "voi",
  "cho", "trong", "ngoai", "tren", "duoi", "mot", "hai", "ba", "bon", "nam",
  "nay", "kia", "gi", "nao", "co", "khong", "nhung", "cac", "the", "and",
  "with", "for", "this", "that", "from", "are", "was", "were", "have", "has",
  "had", "you", "your", "anh", "em", "be",
]);

export const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export const tokenize = (value) => [...new Set(
  normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
)];

const textBoostFor = (item, tokens) => {
  if (!tokens.length) return { boost: 0, matched: [] };
  const nameTokens = new Set(tokenize(item.name));
  const metaTokens = new Set(tokenize([
    item.category, item.color, item.description,
  ].filter(Boolean).join(" ")));
  const nameMatches = tokens.filter((token) => nameTokens.has(token));
  const metaMatches = tokens.filter((token) => metaTokens.has(token));
  const boost = Math.min(0.09,
    nameMatches.length * 0.04 + metaMatches.length * 0.02);
  return {
    boost,
    matched: [...new Set([...nameMatches, ...metaMatches])],
  };
};

export const rankProductsV2 = (
  candidates,
  { ocrText, category, color, limit = 15, minScore, margin } = {},
) => {
  const configuredMinScore = Number(process.env.VISUAL_TOP1_MIN_SCORE);
  const threshold = Number.isFinite(Number(minScore))
    ? Number(minScore)
    : Number.isFinite(configuredMinScore)
      ? configuredMinScore
      : similarityThreshold();
  const marginValue = Number.isFinite(Number(margin))
    ? Number(margin) : Number(process.env.VISUAL_TOP1_MARGIN || 0.001);
  const ocrTokens = tokenize(ocrText);

  const ranked = candidates
    .filter((item) => item.availability === 1 && Number.isFinite(Number(item.similarity)))
    .map((item) => {
      const visual = Number(item.similarity);
      let score = visual;
      const boosts = [];
      // Only enhance candidates that are already close to the visual threshold.
      // A weak visual hit should not jump to the top because of incidental text.
      const canBoost = visual >= threshold - 0.05;

      if (canBoost && category && item.category &&
        normalizeText(item.category) === normalizeText(category)) {
        score += 0.05;
        boosts.push("category");
      }
      if (canBoost && color && item.color &&
        (normalizeText(item.color).includes(normalizeText(color)) ||
          normalizeText(color).includes(normalizeText(item.color)))) {
        score += 0.05;
        boosts.push("color");
      }
      if (canBoost && ocrTokens.length) {
        const { boost, matched } = textBoostFor(item, ocrTokens);
        if (boost > 0) {
          score += boost;
          boosts.push(...matched.map((token) => `text:${token}`));
        }
      }

      return {
        ...item,
        score: Number(Math.min(1, score).toFixed(4)),
        boosts,
      };
    })
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // Precision-first: an uncertain top-1 is worse than no suggestion.
  if (!ranked.length || ranked[0].score < threshold) return [];
  if (ranked.length > 1 && ranked[0].score - ranked[1].score < marginValue) return [];
  return ranked.slice(0, limit);
};

// Chặn open redirect: chỉ cho redirect tới các sàn trong whitelist
const DEFAULT_ALLOWED = ["shopee.vn", "lazada.vn", "tiki.vn", "www.amazon.com"];

export const allowedAffiliateDomains = () =>
  (process.env.AFFILIATE_ALLOWED_DOMAINS || DEFAULT_ALLOWED.join(","))
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

export const validateAffiliateTarget = (url) => {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return { ok: false, reason: "protocol" };
    const host = parsed.hostname.toLowerCase();
    const allowed = allowedAffiliateDomains().some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
    if (!allowed) return { ok: false, reason: "domain" };
    return { ok: true, host };
  } catch {
    return { ok: false, reason: "invalid" };
  }
};
