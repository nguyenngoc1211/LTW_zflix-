import crypto from "node:crypto";

// Provider nhận diện ảnh cho shoppable video.
//   VISION_PROVIDER=gemini  — Google Gemini (khuyên dùng, free 1500 ảnh/ngày, không cần thẻ)
//   VISION_PROVIDER=serpapi — SerpAPI Google Lens engine (free 100 lần/tháng, cần ảnh public URL)
//   VISION_PROVIDER=none    — tắt (mặc định): chỉ match theo mốc thời gian admin gắn

const provider = (process.env.VISION_PROVIDER || "none").trim().toLowerCase();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
const SERPAPI_KEY = (process.env.SERPAPI_KEY || "").trim();
// SerpAPI cần URL ảnh công khai trên internet — chạy local không dùng được trừ khi
// deploy có domain (điền PUBLIC_BASE_URL=https://... để bật).
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/u, "");

export const visionConfigured = () => {
  if (provider === "gemini") return Boolean(GEMINI_API_KEY);
  if (provider === "serpapi") return Boolean(SERPAPI_KEY && PUBLIC_BASE_URL);
  return false;
};

export const visionProviderName = () => provider;

const STRIP_FENCE = /^```(?:json)?\s*|\s*```$/gu;

// Parse response Gemini -> { keyword, category }
export const parseGeminiResponse = (json) => {
  const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";
  const cleaned = text.replace(STRIP_FENCE, "").trim();
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned);
    const keyword = typeof parsed.keyword === "string" ? parsed.keyword.trim().slice(0, 255) : "";
    const category = typeof parsed.category === "string" ? parsed.category.trim().slice(0, 100) : "";
    return keyword ? { keyword, category: category || null } : null;
  } catch {
    // Gemini đôi khi trả text không phải JSON — dùng cả chuỗi làm từ khóa nếu ngắn
    return cleaned.length <= 60 ? { keyword: cleaned, category: null } : null;
  }
};

const PROMPT =
  'Bạn là trợ lý mua sắm. Nhìn vào ảnh món đồ này (được chụp/crop từ một video phim) và trả về ' +
  'DUY NHẤT một JSON (không thêm chữ nào khác) với dạng: ' +
  '{"keyword": "từ khóa ngắn gọn tiếng Việt có dấu để tìm món đồ này trên Shopee", "category": "danh mục ngắn như Thời trang/Phụ kiện/Đồ gia dụng/Điện tử..."} ' +
  'Ví dụ: {"keyword": "đồng hồ đeo tay nam dây thép", "category": "Phụ kiện"}';

const identifyWithGemini = async (base64Jpeg) => {
  const body = {
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: base64Jpeg } }] }],
    generationConfig: { temperature: 0.2, response_mime_type: "application/json" },
  };
  const request = () =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) },
    );
  // Free tier hay gặp 503 quá tải — thử tối đa 2 lần
  let response;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    response = await request();
    if (response.ok || ![429, 503, 500].includes(response.status)) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1600));
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gemini ${response.status}: ${text.slice(0, 150)}`);
  }
  return parseGeminiResponse(await response.json());
};

// SerpAPI Google Lens: yêu cầu URL ảnh công khai (không nhận base64).
const identifyWithSerpapi = async (publicImageUrl) => {
  const params = new URLSearchParams({ url: publicImageUrl, api_key: SERPAPI_KEY });
  const response = await fetch(`https://serpapi.com/google-lens.json?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`SerpAPI ${response.status}`);
  const json = await response.json();
  const matches = json?.visual_matches || [];
  const first = matches[0]?.title || matches[0]?.source?.name;
  return first ? { keyword: String(first).slice(0, 255), category: null } : null;
};

// Nhận diện món đồ từ ảnh (base64 jpeg không prefix data-url) hoặc đường dẫn public ảnh.
// Trả { keyword, category } hoặc null khi không nhận diện được / provider tắt.
export const identifyProduct = async (base64Jpeg, publicImagePath) => {
  try {
    if (provider === "gemini" && GEMINI_API_KEY && base64Jpeg) {
      return await identifyWithGemini(base64Jpeg);
    }
    if (provider === "serpapi" && SERPAPI_KEY && PUBLIC_BASE_URL && publicImagePath) {
      return await identifyWithSerpapi(`${PUBLIC_BASE_URL}/uploads/${publicImagePath}`);
    }
    return null;
  } catch (error) {
    console.warn("Vision provider lỗi (bỏ qua, dùng match thời gian):", error.message);
    return null;
  }
};
