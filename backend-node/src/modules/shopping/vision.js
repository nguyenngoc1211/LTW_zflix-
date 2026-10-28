import crypto from "node:crypto";

// Provider nhận diện ảnh cho shoppable video.
//   VISION_PROVIDER=deepseek — DeepSeek V4 Flash Vision (OpenAI-compatible, ảnh base64)
//   VISION_PROVIDER=gemini  — Google Gemini (free 1500 ảnh/ngày, không cần thẻ)
//   VISION_PROVIDER=serpapi — SerpAPI Google Lens engine (free 100 lần/tháng, cần ảnh public URL)
//   VISION_PROVIDER=none    — tắt (mặc định): chỉ match theo mốc thời gian admin gắn

const provider = (process.env.VISION_PROVIDER || "none").trim().toLowerCase();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
const DEEPSEEK_API_KEY = (process.env.DEEPSEEK_API_KEY || "").trim();
const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "deepseek-v4-flash-vision-exp").trim();
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim().replace(/\/+$/u, "");
const SERPAPI_KEY = (process.env.SERPAPI_KEY || "").trim();
// SerpAPI cần URL ảnh công khai. Hai cách:
//   a) Deploy có domain: điền PUBLIC_BASE_URL=https://... -> dùng ảnh tại /uploads/<file>
//   b) Local: tự upload ảnh lên tmpfiles.org (host miễn phí không cần key, link sống 60 phút)
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/$/u, "");

export const visionConfigured = () => {
  if (provider === "deepseek") return Boolean(DEEPSEEK_API_KEY);
  if (provider === "gemini") return Boolean(GEMINI_API_KEY);
  if (provider === "serpapi") return Boolean(SERPAPI_KEY);
  return false;
};

export const visionProviderName = () => provider;

const STRIP_FENCE = /^```(?:json)?\s*|\s*```$/gu;
// Model hay trả các câu này khi vùng crop mờ/không có món đồ rõ ràng.
const UNKNOWN_TEXT = /^(không xác định|khong xac dinh|không rõ|khong ro|unknown|n\/?a|none|not sure)$/iu;
const cleanField = (value, max) => (typeof value === "string" && !UNKNOWN_TEXT.test(value.trim()) ? value.trim().slice(0, max) : "");

// Parse response dạng { keyword, category, color } — dùng chung Gemini/DeepSeek
const parseIdentifyJson = (text) => {
  const cleaned = String(text || "").replace(STRIP_FENCE, "").trim();
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned);
    const keyword = cleanField(parsed.keyword, 255);
    const category = cleanField(parsed.category, 100);
    const color = cleanField(parsed.color, 50);
    return keyword ? { keyword, category: category || null, color: color || null } : null;
  } catch {
    // Model đôi khi trả text không phải JSON — dùng cả chuỗi làm từ khóa nếu ngắn
    return cleaned.length <= 60 && !UNKNOWN_TEXT.test(cleaned) ? { keyword: cleaned, category: null, color: null } : null;
  }
};

// Parse response Gemini -> { keyword, category, color }
export const parseGeminiResponse = (json) => {
  const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";
  return parseIdentifyJson(text);
};

// Parse response DeepSeek (OpenAI-compatible chat completions) -> { keyword, category, color }
export const parseDeepseekResponse = (json) => {
  const text = json?.choices?.[0]?.message?.content;
  return parseIdentifyJson(text);
};

const PROMPT =
  'Bạn là trợ lý mua sắm. Nhìn vào ảnh món đồ này (được chụp/crop từ một video phim) và trả về ' +
  'DUY NHẤT một JSON (không thêm chữ nào khác) với dạng: ' +
  '{"keyword": "từ khóa ngắn gọn tiếng Việt có dấu để tìm món đồ này trên Shopee", "category": "danh mục ngắn như Thời trang/Phụ kiện/Đồ gia dụng/Điện tử...", "color": "màu chính hoặc null"} ' +
  'Nếu ảnh không có món đồ rõ ràng (mờ, chỉ là nền/da/người), trả {"keyword": "", "category": "", "color": null}. ' +
  'Ví dụ: {"keyword": "đồng hồ đeo tay nam dây thép", "category": "Phụ kiện", "color": "bạc"}';

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

const identifyWithDeepseek = async (base64Jpeg) => {
  const body = {
    model: DEEPSEEK_MODEL,
    temperature: 0.2,
    // Model reasoning tiêu tốn token cho reasoning_content trước khi trả content;
    // 200 token không đủ (content rỗng, finish_reason=length).
    max_tokens: 800,
    messages: [
      { role: "system", content: "Chỉ trả về một JSON hợp lệ, không giải thích." },
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` } },
        ],
      },
    ],
  };
  const request = () =>
    fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
  // Quá tải/rate limit — thử tối đa 2 lần
  let response;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    response = await request();
    if (response.ok || ![429, 500, 503].includes(response.status)) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1600));
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`DeepSeek ${response.status}: ${text.slice(0, 150)}`);
  }
  return parseDeepseekResponse(await response.json());
};

// SerpAPI Google Lens: yêu cầu URL ảnh công khai (không nhận base64).
// Upload ảnh tạm lên tmpfiles.org (free, không key, link sống 60 phút) cho SerpAPI đọc
const uploadTempImage = async (buffer) => {
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: "image/jpeg" }), `lens-${Date.now()}.jpg`);
  const response = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: fd,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`tmpfiles ${response.status}`);
  const json = await response.json();
  const pageUrl = json?.data?.url;
  if (!pageUrl) throw new Error("tmpfiles không trả URL");
  // Trang hiển thị -> link tải trực tiếp
  return pageUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
};

const identifyWithSerpapi = async (publicImageUrl) => {
  const params = new URLSearchParams({ engine: "google_lens", url: publicImageUrl, api_key: SERPAPI_KEY });
  const response = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`SerpAPI ${response.status}`);
  const json = await response.json();
  const matches = json?.visual_matches || [];
  const first = matches[0]?.title || matches[0]?.source?.name || json?.knowledge_graph?.[0]?.title;
  return first ? { keyword: String(first).slice(0, 255), category: null } : null;
};

// Nhận diện món đồ từ ảnh (base64 jpeg không prefix data-url) hoặc đường dẫn public ảnh.
// Trả { keyword, category } hoặc null khi không nhận diện được / provider tắt.
export const identifyProduct = async (base64Jpeg, publicImagePath) => {
  try {
    if (provider === "deepseek" && DEEPSEEK_API_KEY && base64Jpeg) {
      return await identifyWithDeepseek(base64Jpeg);
    }
    if (provider === "gemini" && GEMINI_API_KEY && base64Jpeg) {
      return await identifyWithGemini(base64Jpeg);
    }
    if (provider === "serpapi" && SERPAPI_KEY && base64Jpeg) {
      // Deploy có domain: dùng ảnh trên server của ta; local: upload tạm tmpfiles.org
      const publicUrl =
        PUBLIC_BASE_URL && publicImagePath
          ? `${PUBLIC_BASE_URL}/uploads/${publicImagePath}`
          : await uploadTempImage(Buffer.from(base64Jpeg, "base64"));
      return await identifyWithSerpapi(publicUrl);
    }
    return null;
  } catch (error) {
    console.warn("Vision provider lỗi (bỏ qua, dùng match thời gian):", error.message);
    return null;
  }
};
