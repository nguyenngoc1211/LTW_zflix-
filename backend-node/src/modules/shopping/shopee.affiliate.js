import crypto from "node:crypto";

// Tích hợp Shopee Affiliate Open API Platform (affiliate.shopee.vn -> open.affiliate.shopee.vn)
// Đăng ký app để nhận APP_ID + SECRET_KEY rồi điền vào .env:
//   SHOPEE_AFF_APP_ID, SHOPEE_AFF_SECRET_KEY
// Cấu hình xong: quét đồ vật sẽ hiện sản phẩm Shopee THẬT (ảnh/giá/hoa hồng) và
// nút Mua trả short link https://s.shopee.vn/xxxx gắn tracking affiliate của bạn.

const API_BASE = (process.env.SHOPEE_AFF_API_BASE || "https://open-api.affiliate.shopee.vn").replace(/\/$/u, "");
const APP_ID = (process.env.SHOPEE_AFF_APP_ID || "").trim();
const SECRET_KEY = (process.env.SHOPEE_AFF_SECRET_KEY || "").trim();

export const shopeeAffiliateConfigured = () => Boolean(APP_ID && SECRET_KEY);

// Ký request theo chuẩn Shopee Affiliate Open API:
// signature = HMAC-SHA256(secret_key, app_id + timestamp + json_body)
const signedHeaders = (bodyJson) => {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(`${APP_ID}${timestamp}${bodyJson}`)
    .digest("hex");
  return {
    "Content-Type": "application/json",
    app_id: APP_ID,
    timestamp,
    Authorization: signature,
  };
};

const callApi = async (path, body) => {
  const bodyJson = JSON.stringify(body);
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: signedHeaders(bodyJson),
    body: bodyJson,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(`Shopee Affiliate API ${response.status}: ${text.slice(0, 200)}`);
    error.status = 502;
    throw error;
  }
  return response.json();
};

// Tạo short link affiliate gắn tracking (dùng lúc người dùng bấm Mua)
export const generateShortLink = async (originUrl) => {
  const json = await callApi("/open_api/v2/pap/third_party/generate_short_link", { origin_url: originUrl });
  const shortLink = json?.data?.short_link;
  if (!shortLink) throw new Error("Shopee Affiliate API không trả short_link");
  return shortLink;
};

const toCompactItem = (item) => ({
  itemId: item.item_id,
  shopId: item.shop_id,
  name: item.item_name || item.product_name,
  price: Number(item.price_min || item.price || 0),
  priceMax: Number(item.price_max || 0),
  imageUrl: item.image_url || item.image,
  commissionRate: item.commission_rate ?? item.affiliate_rate,
  sales: item.sales ?? item.global_sales,
  itemUrl: item.item_url || (item.item_id && item.shop_id ? `https://shopee.vn/product/${item.shop_id}/${item.item_id}` : null),
});

// Tìm sản phẩm Shopee thật theo từ khoá (dùng cho kết quả quét khi có key)
export const searchProducts = async (keyword, limit = 5) => {
  const json = await callApi("/open_api/v2/pap/third_party/search_product", {
    keyword,
    page: 1,
    limit: Math.min(10, Math.max(1, limit)),
  });
  const raw = json?.data?.product_list || json?.data?.products || [];
  return raw.map(toCompactItem).filter((item) => item.name && item.itemUrl);
};

// Giá Shopee trả theo đơn vị x100000 — chuyển về VNĐ hiển thị
export const formatShopeePrice = (value) => {
  const vnd = Math.round(Number(value || 0) / 100000);
  return vnd > 0 ? new Intl.NumberFormat("vi-VN").format(vnd) + "₫" : null;
};
