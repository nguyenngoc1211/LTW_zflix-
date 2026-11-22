// Provider nhận diện ảnh cho shoppable video.
//   VISION_PROVIDER=deepseek — DeepSeek V4 Flash Vision (OpenAI-compatible, ảnh base64)
//   VISION_PROVIDER=none    — tắt (mặc định): chỉ match theo mốc thời gian admin gắn

const provider = (process.env.VISION_PROVIDER || "none").trim().toLowerCase();
const DEEPSEEK_API_KEY = (process.env.DEEPSEEK_API_KEY || "").trim();
const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "deepseek-v4-flash-vision-exp").trim();
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim().replace(/\/+$/u, "");

export const visionConfigured = () => {
  if (provider === "deepseek") return Boolean(DEEPSEEK_API_KEY);
  return false;
};

export const visionProviderName = () => provider;

const STRIP_FENCE = /^```(?:json)?\s*|\s*```$/gu;
// Model hay trả các câu này khi vùng crop mờ/không có món đồ rõ ràng.
const UNKNOWN_TEXT = /^(không xác định|khong xac dinh|không rõ|khong ro|unknown|n\/?a|none|not sure)$/iu;
const cleanField = (value, max) => (typeof value === "string" && !UNKNOWN_TEXT.test(value.trim()) ? value.trim().slice(0, max) : "");

// Parse response dạng { keyword, category, color } — dùng cho DeepSeek
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

export const identifyProduct = async (base64Jpeg) => {
  try {
    if (provider === "deepseek" && DEEPSEEK_API_KEY && base64Jpeg) {
      return await identifyWithDeepseek(base64Jpeg);
    }
    return null;
  } catch (error) {
    console.warn("Vision provider lỗi (bỏ qua, dùng match thời gian):", error.message);
    return null;
  }
};
