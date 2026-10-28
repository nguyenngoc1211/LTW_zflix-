import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";
import { requireAuth, requireRole, optionalAuth } from "../../core/middleware/business-auth.bridge.js";
import { searchProductions, syncProductionIndex } from "./search.service.js";
import {
  applyEpisodeAccess,
  isPremiumLocked,
  resolveProductionPremium,
} from "../streaming/playback-access.js";

export const discoveryRouter = Router();

discoveryRouter.get("/filters", asyncHandler(async (req, res) => {
  const [[genres], [countries], [years]] = await Promise.all([
    pool.execute("SELECT id, name, slug FROM genres ORDER BY name"),
    pool.execute("SELECT DISTINCT country FROM productions WHERE country IS NOT NULL ORDER BY country"),
    pool.execute("SELECT DISTINCT release_year FROM productions WHERE release_year IS NOT NULL ORDER BY release_year DESC"),
  ]);
  res.json({ genres, countries: countries.map((item) => item.country), years: years.map((item) => Number(item.release_year)) });
}));

discoveryRouter.get("/productions", asyncHandler(async (req, res) => {
  const { page, limit, offset } = clampPagination(req.query);
  const filters = {
    search: String(req.query.search || "").trim(),
    genre: String(req.query.genre || "").trim(),
    country: String(req.query.country || "").trim(),
    year: req.query.year || "",
    minRating: req.query.minRating || "",
    sortYear: req.query.sortYear === "asc" ? "asc" : "desc",
  };
  if (filters.year && (!Number.isInteger(Number(filters.year)) || Number(filters.year) < 1888)) return res.status(400).json({ message: "Invalid release year" });
  if (filters.minRating && (Number(filters.minRating) < 0 || Number(filters.minRating) > 5)) return res.status(400).json({ message: "minRating must be between 0 and 5" });
  const result = await searchProductions(filters, offset, limit);
  res.json({ ...result, page, limit, pages: Math.ceil(result.total / limit) });
}));

// Autocomplete gợi ý phim khi gõ (kiểu Edge NGram của Elasticsearch — dùng MySQL prefix match)
discoveryRouter.get("/productions/suggest", asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  if (q.length < 1) return res.json({ items: [] });
  const [rows] = await pool.execute(
    `SELECT id, title, poster_url, release_year, rating_avg FROM productions
     WHERE title LIKE ? ORDER BY rating_avg DESC, rating_count DESC LIMIT 8`,
    [`${q}%`],
  );
  res.json({ items: rows });
}));

discoveryRouter.get("/productions/:id", optionalAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id, "production id");
  const [rows] = await pool.execute(`SELECT p.*, GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR '||') AS genres FROM productions p LEFT JOIN production_genres pg ON pg.production_id=p.id LEFT JOIN genres g ON g.id=pg.genre_id WHERE p.id=? GROUP BY p.id`, [id]);
  if (!rows.length) return res.status(404).json({ message: "Production not found" });

  // Series được seed thành 1 production gốc + N production con cho từng mùa
  // (seasons.series_id -> production gốc, seasons.id -> production của mùa).
  // Gom tập từ mọi mùa về production gốc để bấm vào phim là xem được ngay,
  // đồng thời trả `seasons` để UI hiển thị bộ chọn mùa.
  const [seasons] = await pool.execute(
    `SELECT s.id, s.season_number, s.total_episodes, p.title, p.poster_url
       FROM seasons s
       JOIN productions p ON p.id = s.id
      WHERE s.series_id = ?
      ORDER BY s.season_number`,
    [id],
  );

  const ownEpisodes = `SELECT id, episode_number, title, duration, thumbnail_url, video_url
                         FROM episodes WHERE production_id = ?`;
  let episodes;
  if (seasons.length) {
    // Gộp tập của production gốc + tất cả mùa con.
    // Số tập đánh liên tục qua các mùa (mùa 2 tiếp số của mùa 1) để tránh
    // trùng "Tập 1" nhiều lần; vẫn giữ season_number để UI hiển thị theo mùa.
    const seasonIds = seasons.map((s) => s.id);
    const placeholders = seasonIds.map(() => "?").join(",");
    const [merged] = await pool.execute(
      `SELECT e.id, e.episode_number AS episode_in_season, e.title, e.duration,
              e.thumbnail_url, e.video_url, e.production_id AS season_id, s.season_number
         FROM episodes e
         JOIN seasons s ON s.id = e.production_id
        WHERE e.production_id IN (${placeholders})
        ORDER BY s.season_number, e.episode_number`,
      seasonIds,
    );
    let running = 0;
    episodes = merged.map((ep) => {
      running += 1;
      return {
        ...ep,
        episode_number: running,
        // Nhãn đầy đủ để người dùng biết tập thuộc mùa nào
        display_title: `S${ep.season_number}E${ep.episode_in_season} · ${ep.title}`,
      };
    });
  } else {
    const [own] = await pool.execute(`${ownEpisodes} ORDER BY episode_number`, [id]);
    episodes = own;
  }

  const premium = await resolveProductionPremium(id);
  const accessOptions = { premium, user: req.user };
  res.json({
    ...rows[0],
    locked: isPremiumLocked(premium, req.user),
    genres: rows[0].genres ? rows[0].genres.split("||") : [],
    seasons: seasons.map((s) => ({
      id: s.id,
      season_number: s.season_number,
      total_episodes: s.total_episodes,
      title: s.season_number ? `Mùa ${s.season_number}` : s.title,
      poster_url: s.poster_url,
    })),
    episodes: episodes.map((episode) => applyEpisodeAccess(episode, accessOptions)),
  });
}));

discoveryRouter.post("/search/reindex", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const indexed = await syncProductionIndex();
  res.json({ indexed });
}));

discoveryRouter.post("/productions/:id/episodes", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const productionId = parsePositiveInt(req.params.id, "production id");
  const episodeNumber = parsePositiveInt(req.body.episodeNumber, "episode number");
  const duration = parsePositiveInt(req.body.duration, "duration");
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  if (!title || title.length > 255) return res.status(400).json({ message: "title is required and must not exceed 255 characters" });
  const videoUrl = typeof req.body.videoUrl === "string" ? req.body.videoUrl.trim().slice(0, 500) || null : null;
  const thumbnailUrl = typeof req.body.thumbnailUrl === "string" ? req.body.thumbnailUrl.trim().slice(0, 255) || null : null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [productions] = await connection.execute("SELECT id, title FROM productions WHERE id=? FOR UPDATE", [productionId]);
    if (!productions.length) { const error = new Error("Production not found"); error.status = 404; throw error; }
    const [result] = await connection.execute("INSERT INTO episodes (production_id, episode_number, title, video_url, duration, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)", [productionId, episodeNumber, title, videoUrl, duration, thumbnailUrl]);
    await connection.execute(`INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id, redirect_url)
      SELECT b.user_id, 'Có tập mới!', CONCAT(?, ' đã có tập ', ?), 'new_episode', 'episode', ?, CONCAT('/watch/', ?)
      FROM production_interests b WHERE b.production_id=?`, [productions[0].title, episodeNumber, result.insertId, result.insertId, productionId]);
    await connection.commit();
    res.status(201).json({ id: result.insertId, productionId, episodeNumber, title });
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") { error.status = 409; error.message = "Episode number already exists"; }
    throw error;
  } finally { connection.release(); }
}));
