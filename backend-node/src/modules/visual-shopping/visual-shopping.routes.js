import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../../core/database/pool.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler } from "../../core/utils/http.js";
import { embedImage, clipReady } from "./clip.service.js";
import { searchByVector, rebuildIndex, indexStats } from "./vector.index.js";
import { rankProducts, validateAffiliateTarget } from "./ranking.js";

export const visualShoppingRouter = Router();

// Ảnh base64 lớn hơn json global limit — dùng middleware riêng cho các route ảnh
const imageBody = express.json({ limit: "5mb" });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const searchRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  message: { message: "Quá nhiều lần tìm kiếm, thử lại sau 15 phút" },
});

const parseDataUrlImage = (dataUrl) => {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 3_000_000) return null;
  if (buffer.length < 2000) return null;
  return { mime: match[1], buffer };
};

const requireStaff = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

// ---------------------------------------------------------------------------
// GET /visual-search/stats — trạng thái index (debug)
// ---------------------------------------------------------------------------
visualShoppingRouter.post(
  "/visual-search/rebuild",
  requireAuth,
  requireStaff,
  asyncHandler(async (req, res) => {
    await rebuildIndex();
    res.json(await indexStats());
  }),
);

visualShoppingRouter.get(
  "/visual-search/stats",
  asyncHandler(async (req, res) => {
    res.json({ ...(await indexStats()), clip: clipReady() });
  }),
);

// ---------------------------------------------------------------------------
// POST /visual-search — luồng chính: ảnh crop -> CLIP embedding -> HNSW search
// body: { image: dataURL, movieId?, position? }
// ---------------------------------------------------------------------------
visualShoppingRouter.post(
  "/visual-search",
  imageBody,
  searchRateLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const image = parseDataUrlImage(body.image);
    if (!image) {
      return res.status(400).json({
        message: "image phải là dataURL ảnh JPEG/PNG/WebP, dung lượng 2KB–3MB",
      });
    }
    const timings = { cropMs: Number(body.cropMs) || null, embedMs: 0, searchMs: 0, rankMs: 0 };

    const { embedding, embedMs } = await embedImage(image.buffer);
    timings.embedMs = embedMs;

    const { items: vectorHits, searchMs } = await searchByVector(embedding, 20);
    timings.searchMs = searchMs;

    // Lấy chi tiết catalog cho các id tìm được
    const ids = vectorHits.map((hit) => hit.productId);
    let catalog = [];
    if (ids.length) {
      const [rows] = await pool.query(
        `SELECT id, name, description, category, color, price, currency, marketplace,
                product_url, affiliate_url, availability, image_url
         FROM visual_products WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids,
      );
      const byId = new Map(rows.map((row) => [row.id, row]));
      catalog = vectorHits
        .map((hit) => {
          const row = byId.get(hit.productId);
          return row ? { ...row, availability: Number(row.availability), similarity: hit.similarity } : null;
        })
        .filter(Boolean);
    }

    const t0 = Date.now();
    const products = rankProducts(catalog, body.aiFilters || {}, 15);
    timings.rankMs = Date.now() - t0;
    timings.totalMs = timings.embedMs + timings.searchMs + timings.rankMs + (timings.cropMs || 0);

    // Lưu lịch sử tìm kiếm (không lưu ảnh)
    const [searchResult] = await pool
      .execute(
        `INSERT INTO visual_searches (user_id, movie_id, position, results_count, crop_ms, embed_ms, search_ms, rank_ms, total_ms, provider)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'clip')`,
        [req.user?.id ?? null, body.movieId ?? null, Math.floor(Number(body.position) || 0), products.length,
         timings.cropMs, timings.embedMs, timings.searchMs, timings.rankMs, timings.totalMs],
      )
      .catch(() => [null]);

    res.json({
      searchId: searchResult?.insertId ?? null,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        color: product.color,
        price: product.price,
        currency: product.currency,
        marketplace: product.marketplace,
        imageUrl: product.image_url,
        availability: Boolean(product.availability),
        similarity: product.score,
        boosts: product.boosts,
        hasAffiliate: Boolean(product.affiliate_url),
      })),
      timings,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /products/:id — chi tiết sản phẩm catalog
// ---------------------------------------------------------------------------
visualShoppingRouter.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "invalid id" });
    const [rows] = await pool.execute("SELECT * FROM visual_products WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    const row = rows[0];
    delete row.embedding;
    res.json({ ...row, availability: Boolean(row.availability) });
  }),
);

// ---------------------------------------------------------------------------
// GET /affiliate/redirect/:productId — redirect affiliate đã cấu hình + ghi click
// KHÔNG nhận URL từ client — chỉ link đã lưu trong catalog.
// ---------------------------------------------------------------------------
visualShoppingRouter.get(
  "/affiliate/redirect/:productId",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.productId);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "invalid id" });
    const [rows] = await pool.execute(
      "SELECT id, marketplace, affiliate_url, product_url FROM visual_products WHERE id = ? LIMIT 1",
      [id],
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    const product = rows[0];
    const target = product.affiliate_url || product.product_url;
    if (!target) {
      return res.status(409).json({ message: "Sản phẩm này chưa có liên kết mua hàng" });
    }
    const validation = validateAffiliateTarget(target);
    if (!validation.ok) {
      return res.status(409).json({ message: `Liên kết mua không hợp lệ (${validation.reason})` });
    }
    await pool
      .execute(
        "INSERT INTO affiliate_clicks (product_id, search_id, user_id, marketplace, tracking_id) VALUES (?, ?, ?, ?, ?)",
        [id, Number(req.query.searchId) || null, req.user?.id ?? null, product.marketplace,
         `vc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`],
      )
      .catch(() => {});
    res.redirect(302, target);
  }),
);

// ---------------------------------------------------------------------------
// POST /shopping/admin/catalog — admin thêm sản phẩm catalog từ ảnh (base64)
// Dùng để trích frame video demo vào catalog (catalog = chính hình ảnh trong phim)
// ---------------------------------------------------------------------------
visualShoppingRouter.post(
  "/shopping/admin/catalog",
  imageBody,
  requireAuth,
  requireStaff,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 255) : "";
    if (!name) return res.status(400).json({ message: "name là bắt buộc" });
    const image = parseDataUrlImage(body.image);
    if (!image) return res.status(400).json({ message: "image dataURL không hợp lệ" });

    // Lưu ảnh vào uploads (public khi deploy — SerpAPI/có thể dùng lại)
    const fileName = `catalog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), image.buffer);

    // Embed ảnh catalog ngay (model đã warm)
    const { embedding, embedMs } = await embedImage(image.buffer);

    const [result] = await pool.execute(
      `INSERT INTO visual_products (name, description, category, color, price, currency, marketplace, image_url, availability, embedding, embedded_at)
       VALUES (?, ?, ?, ?, ?, 'VND', 'catalog', ?, 1, ?, NOW())`,
      [
        name,
        typeof body.description === "string" ? body.description.trim().slice(0, 1000) || null : null,
        typeof body.category === "string" ? body.category.trim().slice(0, 100) || null : null,
        typeof body.color === "string" ? body.color.trim().slice(0, 50) || null : null,
        Number(body.price) || null,
        `/uploads/${fileName}`,
        JSON.stringify(embedding),
      ],
    );
    await rebuildIndex();
    const [rows] = await pool.execute("SELECT id, name, price FROM visual_products WHERE id = ?", [result.insertId]);
    res.status(201).json({ ...rows[0], embedMs });
  }),
);

// ---------------------------------------------------------------------------
// POST /shopping/admin/catalog/import — import CSV (text) hàng loạt, admin
// ---------------------------------------------------------------------------
visualShoppingRouter.post(
  "/shopping/admin/catalog/import",
  requireAuth,
  requireStaff,
  asyncHandler(async (req, res) => {
    const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
    if (!csv.trim()) return res.status(400).json({ message: "csv là bắt buộc" });
    const lines = csv.trim().split(/\r?\n/);
    const header = lines[0].split(",").map((h) => h.trim());
    const imported = [];
    const errors = [];
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replaceAll('""', '"')) || [];
      const record = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
      try {
        const [r] = await pool.execute(
          `INSERT INTO visual_products (name, description, category, color, price, currency, marketplace, product_url, affiliate_url, image_url, availability)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [record.name || "Không tên", record.description || null, record.category || null, record.color || null,
           Number(record.price) || null, record.currency || "VND", record.marketplace || "catalog",
           record.product_url || null, record.affiliate_url || null, record.image_url],
        );
        imported.push(r.insertId);
      } catch (e) {
        errors.push(`${record.name || "?"}: ${e.message.slice(0, 80)}`);
      }
    }
    await rebuildIndex();
    res.json({ imported: imported.length, errors });
  }),
);
