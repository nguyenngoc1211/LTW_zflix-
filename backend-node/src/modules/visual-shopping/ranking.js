// Ranking thuần (pure) — unit test được mà không cần DB/AI.
// Điểm tương đồng chính là cosine similarity từ vector index; category/color
// chỉ dùng như boost nhỏ khi AI trả về thuộc tính, không bịa điểm.

export const rankProducts = (candidates, { category, color } = {}, limit = 15) => {
  return candidates
    .filter((item) => item.availability === 1)
    .map((item) => {
      let score = item.similarity;
      const boosts = [];
      if (category && item.category && item.category.toLowerCase() === String(category).toLowerCase()) {
        score = Math.min(1, score + 0.05);
        boosts.push("category");
      }
      if (color && item.color && item.color.toLowerCase() === String(color).toLowerCase()) {
        score = Math.min(1, score + 0.05);
        boosts.push("color");
      }
      return { ...item, score: Number(score.toFixed(4)), boosts };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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
