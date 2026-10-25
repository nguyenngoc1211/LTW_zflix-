import { createWorker } from "tesseract.js";

// OCR đọc chữ/logo trong ảnh crop — bổ sung từ khóa tìm kiếm (như TikTok).
// Tesseract.js chạy self-hosted, miễn phí; model eng tải về 1 lần rồi cache.
// Chỉ chạy khi có ảnh — không bao giờ chặn luồng vector search chính (try/catch).

const LANGS = process.env.OCR_LANGS || "eng";

let workerPromise = null;
let warmMs = null;

const getWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const t0 = Date.now();
      const worker = await createWorker(LANGS);
      warmMs = Date.now() - t0;
      console.log(`[OCR] Tesseract worker (${LANGS}) sẵn sàng trong ${warmMs}ms`);
      return worker;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
};

export const ocrReady = async () => {
  await getWorker();
  return { langs: LANGS, warmMs };
};

// Làm sạch text OCR: chỉ giữ từ có chữ cái, bỏ nhiễu 1-2 ký tự
export const cleanOcrText = (raw) => {
  if (!raw) return null;
  const words = String(raw)
    .toUpperCase()
    .replace(/[^A-ZÀ-Ỹ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && /[A-ZÀ-Ỹ]/.test(word));
  const text = [...new Set(words)].slice(0, 6).join(" ");
  return text || null;
};

// OCR ảnh (Buffer) -> { text, ocrMs } hoặc null khi lỗi/không có chữ
export const readText = async (imageBuffer) => {
  try {
    const worker = await getWorker();
    const t0 = Date.now();
    const { data } = await worker.recognize(imageBuffer);
    const ocrMs = Date.now() - t0;
    const text = cleanOcrText(data.text);
    return { text, ocrMs };
  } catch (error) {
    console.warn("[OCR] lỗi (bỏ qua):", error.message.slice(0, 100));
    return null;
  }
};
