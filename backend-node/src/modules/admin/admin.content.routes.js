import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { asyncHandler, parsePositiveInt } from "../../core/utils/http.js";

export const adminContentRouter = Router();

adminContentRouter.use(requireAuth);

// Nội dung (phim/tập): cả admin và moderator đều được thao tác
const requireStaff = (req, res, next) => {
  if (!["admin", "moderator"].includes(req.user?.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

// Xóa phim/tập: chỉ admin
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  next();
};

// ---------------------------------------------------------------------------
// POST /productions — thêm phim mới (kèm thể loại)
// ---------------------------------------------------------------------------
adminContentRouter.post(
  "/productions",
  requireStaff,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const type = body.type === "series" ? "series" : "movie";
    if (!title || title.length > 255) return res.status(400).json({ message: "title là bắt buộc (tối đa 255 ký tự)" });
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
    const releaseYear = Number(body.releaseYear) || null;
    const country = typeof body.country === "string" && body.country.trim() ? body.country.trim().slice(0, 50) : null;
    const language = typeof body.language === "string" && body.language.trim() ? body.language.trim().slice(0, 50) : null;
    const posterUrl = typeof body.posterUrl === "string" && body.posterUrl.trim() ? body.posterUrl.trim().slice(0, 500) : null;
    const bannerUrl = typeof body.bannerUrl === "string" && body.bannerUrl.trim() ? body.bannerUrl.trim().slice(0, 500) : null;
    const isPremium = Boolean(body.isPremium);
    const status = body.status === "completed" ? "completed" : "ongoing";
    const genres = Array.isArray(body.genres) ? body.genres.map(Number).filter(Number.isInteger) : [];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const slugBase = title
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "phim";
      const slug = `${slugBase}-${Date.now().toString(36)}`;
      const [result] = await connection.execute(
        `INSERT INTO productions (type, title, slug, description, poster_url, banner_url, status, release_year, is_premium, country, language)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [type, title, slug, description, posterUrl, bannerUrl, status, releaseYear, isPremium ? 1 : 0, country, language],
      );
      for (const genreId of genres) {
        await connection.execute(
          "INSERT INTO production_genres (production_id, genre_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE genre_id = VALUES(genre_id)",
          [result.insertId, genreId],
        );
      }
      await connection.commit();
      res.status(201).json({ id: result.insertId, title, slug });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /productions/:id — chi tiết phim cho form sửa (gồm thể loại)
// ---------------------------------------------------------------------------
adminContentRouter.get(
  "/productions/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    const productionId = parsePositiveInt(req.params.id, "production id");
    const [rows] = await pool.execute(
      `SELECT p.*, GROUP_CONCAT(g.id ORDER BY g.id) AS genre_ids
       FROM productions p
       LEFT JOIN production_genres pg ON pg.production_id = p.id
       LEFT JOIN genres g ON g.id = pg.genre_id
       WHERE p.id = ? GROUP BY p.id`,
      [productionId],
    );
    if (!rows.length) return res.status(404).json({ message: "Production not found" });
    res.json({ ...rows[0], genre_ids: rows[0].genre_ids ? rows[0].genre_ids.split(",").map(Number) : [] });
  }),
);

// ---------------------------------------------------------------------------
// PUT /productions/:id — cập nhật thông tin phim + thể loại
// ---------------------------------------------------------------------------
adminContentRouter.put(
  "/productions/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    const productionId = parsePositiveInt(req.params.id, "production id");
    const body = req.body || {};
    const [existing] = await pool.execute("SELECT id FROM productions WHERE id = ? LIMIT 1", [productionId]);
    if (!existing.length) return res.status(404).json({ message: "Production not found" });

    const fields = [];
    const params = [];
    const setString = (column, value, maxLength = 500) => {
      if (typeof value !== "string") return;
      fields.push(`${column} = ?`);
      params.push(value.trim().slice(0, maxLength) || null);
    };
    if (typeof body.title === "string" && body.title.trim()) setString("title", body.title, 255);
    setString("description", body.description, 2000);
    setString("poster_url", body.posterUrl);
    setString("banner_url", body.bannerUrl);
    setString("country", body.country, 50);
    setString("language", body.language, 50);
    if (body.releaseYear !== undefined) { fields.push("release_year = ?"); params.push(Number(body.releaseYear) || null); }
    if (body.isPremium !== undefined) { fields.push("is_premium = ?"); params.push(body.isPremium ? 1 : 0); }
    if (body.status !== undefined && ["ongoing", "completed"].includes(body.status)) { fields.push("status = ?"); params.push(body.status); }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      if (fields.length) {
        await connection.execute(`UPDATE productions SET ${fields.join(", ")} WHERE id = ?`, [...params, productionId]);
      }
      if (Array.isArray(body.genres)) {
        await connection.execute("DELETE FROM production_genres WHERE production_id = ?", [productionId]);
        for (const genreId of body.genres.map(Number).filter(Number.isInteger)) {
          await connection.execute("INSERT INTO production_genres (production_id, genre_id) VALUES (?, ?)", [productionId, genreId]);
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const [rows] = await pool.execute(
      `SELECT p.*, GROUP_CONCAT(g.id ORDER BY g.id) AS genre_ids FROM productions p
       LEFT JOIN production_genres pg ON pg.production_id = p.id LEFT JOIN genres g ON g.id = pg.genre_id
       WHERE p.id = ? GROUP BY p.id`,
      [productionId],
    );
    res.json({ ...rows[0], genre_ids: rows[0].genre_ids ? rows[0].genre_ids.split(",").map(Number) : [] });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /productions/:id — xóa phim (chặn nếu còn dữ liệu liên quan)
// ---------------------------------------------------------------------------
adminContentRouter.delete(
  "/productions/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const productionId = parsePositiveInt(req.params.id, "production id");
    try {
      const [result] = await pool.execute("DELETE FROM productions WHERE id = ?", [productionId]);
      if (!result.affectedRows) return res.status(404).json({ message: "Production not found" });
      res.status(204).end();
    } catch (error) {
      if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({ message: "Phim đang có tập/yêu thích/đánh giá liên quan — hãy xóa các tập trước" });
      }
      throw error;
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /productions/:id/episodes — danh sách tập
// ---------------------------------------------------------------------------
adminContentRouter.get(
  "/productions/:id/episodes",
  requireStaff,
  asyncHandler(async (req, res) => {
    const productionId = parsePositiveInt(req.params.id, "production id");
    const [rows] = await pool.execute(
      "SELECT id, episode_number, title, video_url, thumbnail_url, duration FROM episodes WHERE production_id = ? ORDER BY episode_number",
      [productionId],
    );
    res.json({ items: rows });
  }),
);

// ---------------------------------------------------------------------------
// POST /productions/:id/episodes — thêm tập + thông báo người quan tâm (logic của Hai)
// ---------------------------------------------------------------------------
adminContentRouter.post(
  "/productions/:id/episodes",
  requireStaff,
  asyncHandler(async (req, res) => {
    const productionId = parsePositiveInt(req.params.id, "production id");
    const episodeNumber = parsePositiveInt(req.body?.episodeNumber, "episode number");
    const duration = Number(req.body?.duration) || 0;
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title || title.length > 255) return res.status(400).json({ message: "title là bắt buộc (tối đa 255 ký tự)" });
    const videoUrl = typeof req.body?.videoUrl === "string" ? req.body.videoUrl.trim().slice(0, 500) || null : null;
    const thumbnailUrl = typeof req.body?.thumbnailUrl === "string" ? req.body.thumbnailUrl.trim().slice(0, 255) || null : null;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [productions] = await connection.execute("SELECT id, title FROM productions WHERE id=? FOR UPDATE", [productionId]);
      if (!productions.length) { const error = new Error("Production not found"); error.status = 404; throw error; }
      const [result] = await connection.execute(
        "INSERT INTO episodes (production_id, episode_number, title, video_url, duration, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)",
        [productionId, episodeNumber, title, videoUrl, duration, thumbnailUrl],
      );
      await connection.execute(
        `INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id, redirect_url)
         SELECT b.user_id, 'Có tập mới!', CONCAT(?, ' đã có tập ', ?), 'new_episode', 'episode', ?, CONCAT('/watch/', ?)
         FROM production_interests b WHERE b.production_id=?`,
        [productions[0].title, episodeNumber, result.insertId, result.insertId, productionId],
      );
      await connection.commit();
      res.status(201).json({ id: result.insertId, productionId, episodeNumber, title });
    } catch (error) {
      await connection.rollback();
      if (error.code === "ER_DUP_ENTRY") { error.status = 409; error.message = "Số tập này đã tồn tại"; }
      throw error;
    } finally {
      connection.release();
    }
  }),
);

// ---------------------------------------------------------------------------
// PATCH /episodes/:id — sửa tập
// ---------------------------------------------------------------------------
adminContentRouter.patch(
  "/episodes/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    const episodeId = parsePositiveInt(req.params.id, "episode id");
    const body = req.body || {};
    const fields = [];
    const params = [];
    if (typeof body.title === "string" && body.title.trim()) { fields.push("title = ?"); params.push(body.title.trim().slice(0, 255)); }
    if (typeof body.videoUrl === "string") { fields.push("video_url = ?"); params.push(body.videoUrl.trim().slice(0, 500) || null); }
    if (body.duration !== undefined) { fields.push("duration = ?"); params.push(Number(body.duration) || 0); }
    if (!fields.length) return res.status(400).json({ message: "Không có trường nào để cập nhật" });
    const [result] = await pool.execute(`UPDATE episodes SET ${fields.join(", ")} WHERE id = ?`, [...params, episodeId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Episode not found" });
    const [rows] = await pool.execute("SELECT id, production_id, episode_number, title, video_url, duration FROM episodes WHERE id = ?", [episodeId]);
    res.json(rows[0]);
  }),
);

// ---------------------------------------------------------------------------
// DELETE /episodes/:id — xóa tập
// ---------------------------------------------------------------------------
adminContentRouter.delete(
  "/episodes/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const episodeId = parsePositiveInt(req.params.id, "episode id");
    try {
      const [result] = await pool.execute("DELETE FROM episodes WHERE id = ?", [episodeId]);
      if (!result.affectedRows) return res.status(404).json({ message: "Episode not found" });
      res.status(204).end();
    } catch (error) {
      if (error.code === "ER_ROW_IS_REFERENCED_2") {
        return res.status(409).json({ message: "Tập này đang có lịch sử xem — không xóa được" });
      }
      throw error;
    }
  }),
);
