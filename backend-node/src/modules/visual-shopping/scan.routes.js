// CineLens scan API — nhận ảnh vùng quét dạng multipart/form-data (hoặc JSON base64),
// chạy CLIP embedding + HNSW vector search trên Local Catalog + OCR đọc chữ.
// Response shape theo spec CineLens: detected_objects / products / mode.
import multer from "multer";
import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { embedImage, clipReady } from "./clip.service.js";
import { searchByVector } from "./vector.index.js";
import { rankProducts, similarityThreshold } from "./ranking.js";
import { readText } from "./ocr.service.js";

export const scanRouter = Router();

// Multipart upload: ảnh vùng quét tối đa 5MB, giữ trong bộ nhớ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Chỉ chấp nhận ảnh JPEG/PNG/WebP"));
  },
});

const scanLimiter = rateLimitSafe();

function rateLimitSafe() {
  // Rate limit đơn giản trong bộ nhớ (30 lượt / 15 phút / IP) — tránh thêm dep
  const hits = new Map();
  const WINDOW = 15 * 60 * 1000;
  const LIMIT = 30;
  setInterval(() => hits.clear(), WINDOW).unref();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, reset: now + WINDOW };
    if (now > entry.reset) { entry.count = 0; entry.reset = now + WINDOW; }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > LIMIT) {
      return res.status(429).json({ message: "Quá nhiều lần quét, thử lại sau 15 phút" });
    }
    next();
  };
}

// Chế độ phản ánh NGUỒN SẢN PHẨM đang dùng (theo spec CineLens):
// "demo" = Local Catalog mẫu; "real" = khi tích hợp API sàn/feed đối tác thật.
// LLM fallback (Gemini OCR) không đổi nguồn sản phẩm.
const currentMode = () => "demo";

scanRouter.post(
  "/scan",
  scanLimiter,
  upload.single("image"),
  async (req, res) => {
    const timings = { cropMs: Number(req.body?.cropMs) || null, embedMs: 0, searchMs: 0, rankMs: 0, ocrMs: 0 };
    try {
      // Ảnh: từ multipart file hoặc JSON base64 (tương thích luồng cũ)
      let imageBuffer = req.file?.buffer;
      if (!imageBuffer && req.body?.image) {
        const match = /^data:image\/\w+;base64,(.+)$/.exec(req.body.image);
        if (match) imageBuffer = Buffer.from(match[1], "base64");
      }
      if (!imageBuffer) {
        return res.status(400).json({ message: "Thiếu ảnh vùng quét (field 'image' dạng multipart hoặc dataURL)" });
      }
      if (imageBuffer.length > 5 * 1024 * 1024) {
        return res.status(413).json({ message: "Ảnh quá lớn (tối đa 5MB)" });
      }

      await clipReady();
      const { embedding, embedMs } = await embedImage(imageBuffer);
      timings.embedMs = embedMs;

      const { items: hits, searchMs } = await searchByVector(embedding, 20);
      timings.searchMs = searchMs;

      const ids = hits.map((hit) => hit.productId);
      let catalog = [];
      if (ids.length) {
        const [rows] = await pool.query(
          `SELECT id, name, description, category, color, price, currency, marketplace,
                  product_url, affiliate_url, availability, image_url
           FROM visual_products WHERE id IN (${ids.map(() => "?").join(",")})`,
          ids,
        );
        const byId = new Map(rows.map((row) => [row.id, row]));
        catalog = hits
          .map((hit) => {
            const row = byId.get(hit.productId);
            return row ? { ...row, availability: Number(row.availability), similarity: hit.similarity } : null;
          })
          .filter(Boolean);
      }

      const t0 = Date.now();
      const ranked = rankProducts(catalog, {}, 15);
      timings.rankMs = Date.now() - t0;

      // OCR đọc chữ/logo trong ảnh (như TikTok) — lỗi không chặn luồng
      let ocr = null;
      try {
        ocr = await readText(imageBuffer);
        if (ocr?.text) timings.ocrMs = ocr.ocrMs;
      } catch { /* bỏ qua */ }

      const t1 = Date.now();
      timings.totalMs =
        (timings.cropMs || 0) + timings.embedMs + timings.searchMs + timings.rankMs + (timings.ocrMs || 0) + (t1 - t0);

      // detected_objects: KHÔNG bịa. Chỉ có khi OCR đọc được chữ hoặc AI LLM fallback trả kết quả.
      const detected_objects = [];
      if (ocr?.text) {
        detected_objects.push({ name: ocr.text, source: "ocr", confidence: null });
      }
      const aiKeyword = ocr?.text ?? null;

      // Lưu lịch sử (không lưu ảnh)
      pool
        .execute(
          `INSERT INTO visual_searches (user_id, movie_id, position, results_count, crop_ms, embed_ms, search_ms, rank_ms, total_ms, provider, ai_keyword)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'clip', ?)`,
          [req.user?.id ?? null, Number(req.body?.movieId) || null, Math.floor(Number(req.body?.position) || 0),
           ranked.length, timings.cropMs, timings.embedMs, timings.searchMs, timings.rankMs, timings.totalMs, aiKeyword],
        )
        .catch(() => {});

      const products = ranked.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        color: item.color,
        price: item.price,
        currency: item.currency,
        platform: item.marketplace === "catalog" ? "Zflix Catalog (demo)" : item.marketplace,
        image: item.image_url,
        similarity: item.score,
        availability: Boolean(item.availability),
        hasAffiliate: Boolean(item.affiliate_url),
        // Chưa cấu hình affiliate: chỉ trả link SEARCH của sàn (URL-encoded, mở tab mới)
        searchUrl: `https://shopee.vn/search?keyword=${encodeURIComponent(item.name)}`,
      }));

      res.json({
        mode: currentMode(),
        detected_objects,
        products,
        ocrText: ocr?.text ?? null,
        timings,
        message: ranked.length ? null : "Lensy không tìm thấy sản phẩm phù hợp với vùng này — thử khoanh vùng khác nhé!",
      });
    } catch (error) {
      console.error("[scan] lỗi:", error.message.slice(0, 150));
      res.status(500).json({ message: "Lensy gặp lỗi khi phân tích — thử lại nhé!", detail: error.message.slice(0, 120) });
    }
  },
);

// Chi tiết 1 sản phẩm (cho panel "Xem sản phẩm")
scanRouter.get("/scan/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "invalid id" });
  const [rows] = await pool.execute("SELECT * FROM visual_products WHERE id = ? LIMIT 1", [id]);
  if (!rows.length) return res.status(404).json({ message: "Product not found" });
  const row = rows[0];
  delete row.embedding;
  res.json({ ...row, availability: Boolean(row.availability) });
});
