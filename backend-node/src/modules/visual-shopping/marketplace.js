// Tra sản phẩm thật trên sàn theo từ khoá do AI nhận diện (DeepSeek/Gemini).
// Tiki có API tìm kiếm công khai, không cần đăng ký KOL/đối tác như Shopee.
// Kết quả được cache ngắn để nhiều người quét cùng món đồ không gọi sàn liên tục.
const TIKI_SEARCH_URL = "https://tiki.vn/api/v2/products";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;

const cache = new Map();

const toProduct = (item) => {
  if (!item?.id || !item?.name) return null;
  const productUrl = item.url_path ? `https://tiki.vn/${item.url_path}` : null;
  return {
    id: `tiki-${item.id}`,
    name: item.name,
    description: item.brand_name || null,
    category: item.primary_category_name || null,
    color: null,
    price: Number(item.price) || null,
    currency: "VND",
    platform: "Tiki",
    image: item.thumbnail_url || null,
    productUrl,
    searchUrl: productUrl,
    affiliateUrl: null,
    similarity: null,
    availability: Boolean(item.availability),
    hasAffiliate: false,
    rating: Number(item.rating_average) || null,
    reviews: Number(item.review_count) || 0,
  };
};

export const searchMarketplace = async (keyword, limit = 10) => {
  const query = String(keyword || "").trim();
  if (!query) return [];

  const cached = cache.get(query);
  if (cached && cached.expires > Date.now()) return cached.products.slice(0, limit);

  const params = new URLSearchParams({ q: query, limit: String(Math.max(limit, 10)) });
  const response = await fetch(`${TIKI_SEARCH_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "vi-VN,vi;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Tiki ${response.status}`);

  const json = await response.json();
  const products = (json?.data || []).map(toProduct).filter(Boolean);

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(query, { expires: Date.now() + CACHE_TTL_MS, products });
  return products.slice(0, limit);
};
