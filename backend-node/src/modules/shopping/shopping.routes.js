import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../core/database/pool.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";

export const shoppingRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Affiliate: cấu hình prefix (vd ACCESSTRADE/Shopee Affiliate wrapper) trong .env.
// Để trống thì trả link Shopee search thường — ứng dụng vẫn chạy đầy đủ.
const AFFILIATE_PREFIX = (process.env.SHOPEE_AFFILIATE_PREFIX || "").trim();

export const buildShopeeLink = (keyword) => {
  const searchUrl = `https://shopee.vn/search?keyword=${encodeURIComponent(keyword)}`;
  return AFFILIATE_PREFIX ? `${AFFILIATE_PREFIX}${encodeURIComponent(searchUrl)}` : searchUrl;
};

const toProductView = (row) => ({
  id: row.id,
  productionId: row.production_id,
  episodeId: row.episode_id,
  timestampStart: row.timestamp_start,
  timestampEnd: row.timestamp_end,
  productName: row.product_name,
  category: row.category,
  imageUrl: row.image_url,
  shopeeKeyword: row.shopee_keyword,
  note: row.note,
  clickCount: row.click_count,
  shopeeUrl: buildShopeeLink(row.shopee_keyword),
});

// ---------------------------------------------------------------------------
// GET /shopping/productions/:id/products — danh sách sản phẩm của phim (công khai)
// ---------------------------------------------------------------------------
shoppingRouter.get(
  "/shopping/productions/:id/products",
  asyncHandler(async (req, res) => {
    const productionId = parsePositiveInt(req.params.id, "production id");
    const [rows] = await pool.execute(
      "SELECT * FROM production_products WHERE production_id = ? ORDER BY timestamp_start ASC",
      [productionId],
    );
    res.json({ items: rows.map(toProductView), affiliateEnabled: Boolean(AFFILIATE_PREFIX) });
  }),
);

// ---------------------------------------------------------------------------
// POST /shopping/match — "quét ảnh"/chụp khung hình: match theo thời điểm xem
// body: { episodeId, position, photo? (base64 data URL, tùy chọn), keyword? }
// ---------------------------------------------------------------------------
shoppingRouter.post(
  "/shopping/match",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const episodeId = Number(body.episodeId);
    const position = Math.max(0, Number(body.position) || 0);
    const keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 255) : "";
    const photo = typeof body.photo === "string" && body.photo.startsWith("data:image") ? body.photo : null;

    if (!Number.isInteger(episodeId) || episodeId < 1) {
      return res.status(400).json({ message: "episodeId là bắt buộc" });
    }

    // Match sản phẩm theo mốc thời gian của tập đang xem
    const [matches] = await pool.execute(
      `SELECT pp.* FROM production_products pp
       WHERE (pp.episode_id = ? OR pp.episode_id IS NULL AND pp.production_id = (SELECT e.production_id FROM episodes e WHERE e.id = ?))
         AND ? BETWEEN pp.timestamp_start AND pp.timestamp_end`,
      [episodeId, episodeId, position],
    );

    // Lưu snapshot (ảnh chụp + kết quả match) để đối chiếu / huấn luyện AI sau này
    let imagePath = null;
    if (photo) {
      const base64 = photo.split(",")[1] || "";
      if (base64.length > 4_000_000) return res.status(413).json({ message: "Ảnh quá lớn (tối đa ~3MB)" });
      imagePath = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      fs.promises.writeFile(path.join(UPLOAD_DIR, imagePath), Buffer.from(base64, "base64")).catch(() => {});
    }
    if (photo || keyword) {
      await pool.execute(
        "INSERT INTO product_snapshots (user_id, episode_id, position, image_path, matched_product_id, keyword_used) VALUES (?, ?, ?, ?, ?, ?)",
        [req.user?.id ?? null, episodeId, position, imagePath, matches[0]?.id ?? null, keyword || null],
      ).catch(() => {});
    }

    // Có từ khoá thủ công thì trả luôn link Shopee tìm với từ khoá đó
    const quickSearch = keyword ? { keyword, shopeeUrl: buildShopeeLink(keyword) } : null;
    res.json({
      position,
      items: matches.map(toProductView),
      quickSearch,
      affiliateEnabled: Boolean(AFFILIATE_PREFIX),
      note: matches.length
        ? null
        : "Chưa có sản phẩm nào được gắn ở thời điểm này — dùng tìm nhanh theo từ khoá hoặc quay lại sau.",
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /shopping/products/:id/click — ghi nhận lượt bấm mua (thống kê)
// ---------------------------------------------------------------------------
shoppingRouter.post(
  "/shopping/products/:id/click",
  asyncHandler(async (req, res) => {
    const productId = parsePositiveInt(req.params.id, "product id");
    await pool.execute("UPDATE production_products SET click_count = click_count + 1 WHERE id = ?", [productId]);
    const [rows] = await pool.execute("SELECT id, shopee_keyword, click_count FROM production_products WHERE id = ?", [productId]);
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.json({ id: productId, shopeeUrl: buildShopeeLink(rows[0].shopee_keyword), clickCount: rows[0].click_count });
  }),
);

// ---------------------------------------------------------------------------
// Phần admin/moderator: gắn sản phẩm vào mốc thời gian
// ---------------------------------------------------------------------------
const requireStaff = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

shoppingRouter.get(
  "/shopping/admin/products",
  requireAuth,
  requireStaff,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination({ ...req.query, limit: req.query.limit || 20 });
    const [countRows] = await pool.execute("SELECT COUNT(*) AS total FROM production_products");
    const [rows] = await pool.execute(
      `SELECT pp.*, p.title AS production_title FROM production_products pp
       JOIN productions p ON p.id = pp.production_id
       ORDER BY pp.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    res.json({
      items: rows.map((row) => ({ ...toProductView(row), productionTitle: row.production_title })),
      page,
      limit,
      total: countRows[0].total,
      pages: Math.max(1, Math.ceil(countRows[0].total / limit)),
    });
  }),
);

shoppingRouter.post(
  "/shopping/admin/products",
  requireAuth,
  requireStaff,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const productionId = parsePositiveInt(body.productionId, "production id");
    const episodeId = Number(body.episodeId) || null;
    const timestampStart = Math.max(0, Number(body.timestampStart) || 0);
    const timestampEnd = Math.max(timestampStart, Number(body.timestampEnd) || timestampStart);
    const productName = typeof body.productName === "string" ? body.productName.trim() : "";
    const shopeeKeyword = typeof body.shopeeKeyword === "string" ? body.shopeeKeyword.trim() : "";
    if (!productName || !shopeeKeyword) {
      return res.status(400).json({ message: "productName và shopeeKeyword là bắt buộc" });
    }
    const [existing] = await pool.execute("SELECT id FROM productions WHERE id = ? LIMIT 1", [productionId]);
    if (!existing.length) return res.status(404).json({ message: "Production not found" });

    const [result] = await pool.execute(
      `INSERT INTO production_products (production_id, episode_id, timestamp_start, timestamp_end, product_name, category, image_url, shopee_keyword, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productionId,
        episodeId,
        timestampStart,
        timestampEnd,
        productName,
        typeof body.category === "string" ? body.category.trim().slice(0, 100) || null : null,
        typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) || null : null,
        shopeeKeyword,
        typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null,
        req.user?.id ?? null,
      ],
    );
    const [rows] = await pool.execute("SELECT * FROM production_products WHERE id = ?", [result.insertId]);
    res.status(201).json(toProductView(rows[0]));
  }),
);

shoppingRouter.delete(
  "/shopping/admin/products/:id",
  requireAuth,
  requireStaff,
  asyncHandler(async (req, res) => {
    const productId = parsePositiveInt(req.params.id, "product id");
    const [result] = await pool.execute("DELETE FROM production_products WHERE id = ?", [productId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Product not found" });
    res.status(204).end();
  }),
);

// Thống kê snapshot người dùng chụp (trang admin)
shoppingRouter.get(
  "/shopping/admin/snapshots",
  requireAuth,
  requireStaff,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = clampPagination({ ...req.query, limit: req.query.limit || 20 });
    const [countRows] = await pool.execute("SELECT COUNT(*) AS total FROM product_snapshots");
    const [rows] = await pool.execute(
      `SELECT ps.*, u.username, pp.product_name AS matched_product, e.title AS episode_title
       FROM product_snapshots ps
       LEFT JOIN users u ON u.id = ps.user_id
       LEFT JOIN production_products pp ON pp.id = ps.matched_product_id
       LEFT JOIN episodes e ON e.id = ps.episode_id
       ORDER BY ps.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    res.json({ items: rows, page, limit, total: countRows[0].total, pages: Math.max(1, Math.ceil(countRows[0].total / limit)) });
  }),
);
