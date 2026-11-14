import { Router } from "express";
import { queueEpisodeNotification } from '../community/episode-notification.job.js';
import { pool } from "../../core/database/pool.js";
import { fromMongo, mongoCollection, nextNumericId, withMongoTransaction } from "../../core/database/mongo.js";
import { asyncHandler, clampPagination, parsePositiveInt } from "../../core/utils/http.js";
import { requireAuth, requireRole, optionalAuth } from "../../core/middleware/business-auth.bridge.js";
import { rankTitleSuggestions, searchProductions, syncProductionIndex } from "./search.service.js";
import {
  applyEpisodeAccess,
  isPremiumLocked,
  resolveProductionPremium,
} from "../streaming/playback-access.js";

export const discoveryRouter = Router();

const mongoProductionDetail = async (id, viewer) => {
  const [production, genreLinks, seasonRows] = await Promise.all([
    (await mongoCollection("productions")).findOne({ id }),
    (await mongoCollection("production_genres")).find({ production_id: id }).toArray(),
    (await mongoCollection("seasons")).find({ series_id: id }).sort({ season_number: 1 }).toArray(),
  ]);
  if (!production) return null;
  const genreIds = genreLinks.map((link) => link.genre_id);
  const genres = genreIds.length
    ? await (await mongoCollection("genres")).find({ id: { $in: genreIds } }).sort({ name: 1 }).toArray()
    : [];
  const seasonIds = seasonRows.map((season) => season.id);
  const seasonProductions = seasonIds.length
    ? await (await mongoCollection("productions")).find({ id: { $in: seasonIds } }).toArray()
    : [];
  const seasonMap = new Map(seasonRows.map((season) => [season.id, season]));
  const seasonProductionMap = new Map(seasonProductions.map((item) => [item.id, item]));
  const episodes = await (await mongoCollection("episodes"))
    .find({ production_id: seasonIds.length ? { $in: seasonIds } : id }).toArray();
  let visibleEpisodes;
  if (seasonIds.length) {
    episodes.sort((a, b) => seasonMap.get(a.production_id).season_number - seasonMap.get(b.production_id).season_number
      || a.episode_number - b.episode_number);
    visibleEpisodes = episodes.map((item, index) => ({
      ...fromMongo(item), episode_in_season: item.episode_number,
      season_id: item.production_id, season_number: seasonMap.get(item.production_id).season_number,
      episode_number: index + 1,
      display_title: `S${seasonMap.get(item.production_id).season_number}E${item.episode_number} · ${item.title}`,
    }));
  } else {
    visibleEpisodes = episodes.sort((a, b) => a.episode_number - b.episode_number).map(fromMongo);
  }
  const premium = await resolveProductionPremium(id);
  return {
    ...fromMongo(production), locked: isPremiumLocked(premium, viewer),
    genres: genres.map((genre) => genre.name),
    seasons: seasonRows.map((season) => ({
      id: season.id, season_number: season.season_number,
      total_episodes: season.total_episodes,
      title: season.season_number ? `Mùa ${season.season_number}` : seasonProductionMap.get(season.id)?.title,
      poster_url: seasonProductionMap.get(season.id)?.poster_url,
    })),
    episodes: visibleEpisodes.map((episode) => applyEpisodeAccess(episode, { premium, user: viewer })),
  };
};

discoveryRouter.get("/filters", asyncHandler(async (req, res) => {
  if (process.env.DATA_STORE === "mongodb") {
    const [genres, countries, years] = await Promise.all([
      (await mongoCollection("genres")).find({}, { projection: { _id: 0, id: 1, name: 1, slug: 1 } }).sort({ name: 1 }).toArray(),
      (await mongoCollection("productions")).distinct("country", { country: { $ne: null } }),
      (await mongoCollection("productions")).distinct("release_year", { release_year: { $ne: null } }),
    ]);
    return res.json({ genres, countries: countries.sort(), years: years.map(Number).sort((a, b) => b - a) });
  }
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

// Keep the catalog API unchanged; this endpoint ranks the banner by recorded watches.
discoveryRouter.get("/productions/top", asyncHandler(async (req, res) => {
  if (process.env.DATA_STORE === "mongodb") {
    const [productions, episodes, seasons, history, links, genres] = await Promise.all([
      (await mongoCollection("productions")).find({ type: { $in: ["movie", "series"] } }).toArray(),
      (await mongoCollection("episodes")).find({}, { projection: { id: 1, production_id: 1 } }).toArray(),
      (await mongoCollection("seasons")).find({}, { projection: { id: 1, series_id: 1 } }).toArray(),
      (await mongoCollection("watch_history")).find({}, { projection: { episode_id: 1 } }).toArray(),
      (await mongoCollection("production_genres")).find({}, { projection: { production_id: 1, genre_id: 1 } }).toArray(),
      (await mongoCollection("genres")).find({}, { projection: { id: 1, name: 1 } }).toArray(),
    ]);
    const parent = new Map(seasons.map((item) => [item.id, item.series_id]));
    const episodeProduction = new Map(episodes.map((item) => [item.id, parent.get(item.production_id) || item.production_id]));
    const counts = new Map();
    const episodeCounts = new Map();
    const seasonCounts = new Map();
    for (const item of episodes) {
      const id = parent.get(item.production_id) || item.production_id;
      episodeCounts.set(id, (episodeCounts.get(id) || 0) + 1);
    }
    for (const item of seasons) seasonCounts.set(item.series_id, (seasonCounts.get(item.series_id) || 0) + 1);
    for (const item of history) {
      const id = episodeProduction.get(item.episode_id);
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    }
    const genreNames = new Map(genres.map((item) => [item.id, item.name]));
    const productionGenres = new Map();
    for (const link of links) {
      if (!genreNames.has(link.genre_id)) continue;
      productionGenres.set(link.production_id, [...(productionGenres.get(link.production_id) || []), genreNames.get(link.genre_id)]);
    }
    const items = productions.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0)
      || Number(b.release_year || 0) - Number(a.release_year || 0) || a.id - b.id)
      .slice(0, 5).map((item) => ({ ...fromMongo(item), genres: productionGenres.get(item.id) || [],
        view_count: counts.get(item.id) || 0, episode_count: episodeCounts.get(item.id) || 0,
        season_count: seasonCounts.get(item.id) || 0 }));
    return res.json({ items });
  }
  const [rows] = await pool.execute(`SELECT p.id, p.title, p.description, p.banner_url, p.poster_url,
    p.release_year, p.type, COUNT(DISTINCT wh.user_id, wh.episode_id) AS view_count,
    COUNT(DISTINCT e.id) AS episode_count, COUNT(DISTINCT s.id) AS season_count,
    GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR '||') AS genres
    FROM productions p
    LEFT JOIN seasons s ON s.series_id = p.id
    LEFT JOIN episodes e ON e.production_id = p.id OR e.production_id = s.id
    LEFT JOIN watch_history wh ON wh.episode_id = e.id
    LEFT JOIN production_genres pg ON pg.production_id = p.id
    LEFT JOIN genres g ON g.id = pg.genre_id
    WHERE p.type IN ('movie', 'series') GROUP BY p.id
    ORDER BY view_count DESC, p.release_year DESC, p.id ASC LIMIT 5`);
  res.json({ items: rows.map((item) => ({ ...item, view_count: Number(item.view_count),
    episode_count: Number(item.episode_count), season_count: Number(item.season_count),
    genres: item.genres ? item.genres.split("||") : [] })) });
}));

// Autocomplete gợi ý khi chuỗi xuất hiện ở bất kỳ vị trí nào trong tên phim.
discoveryRouter.get("/productions/suggest", asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  if (q.length < 1) return res.json({ items: [] });
  if (process.env.DATA_STORE === "mongodb") {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rows = await (await mongoCollection("productions")).find({
      title: { $regex: escaped, $options: "i" }, type: { $in: ["movie", "series"] },
    }, { projection: { _id: 0, id: 1, title: 1, poster_url: 1, release_year: 1, rating_avg: 1 } })
      .sort({ rating_avg: -1, rating_count: -1 }).limit(100).toArray();
    return res.json({ items: rankTitleSuggestions(rows.map(fromMongo), q) });
  }
  const [rows] = await pool.execute(
    `SELECT id, title, poster_url, release_year, rating_avg FROM productions
     WHERE title LIKE ? AND type IN ('movie', 'series')
     ORDER BY rating_avg DESC, rating_count DESC LIMIT 100`,
    [`%${q}%`],
  );
  res.json({ items: rankTitleSuggestions(rows, q) });
}));

discoveryRouter.get("/productions/:id", optionalAuth, asyncHandler(async (req, res) => {
  const id = parsePositiveInt(req.params.id, "production id");
  if (process.env.DATA_STORE === "mongodb") {
    const detail = await mongoProductionDetail(id, req.user);
    return detail ? res.json(detail) : res.status(404).json({ message: "Production not found" });
  }
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
  const batchId = req.body?.publicationBatchId;
  const batchComplete = req.body?.publicationBatchComplete === true;
  if ((batchId !== undefined && (typeof batchId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(batchId))) ||
    (req.body?.publicationBatchComplete !== undefined && typeof req.body.publicationBatchComplete !== 'boolean') ||
    (batchComplete && !batchId) || (batchId && !videoUrl)) return res.status(400).json({ message: 'Invalid publication batch' });
  if (process.env.DATA_STORE === "mongodb") {
    const result = await withMongoTransaction(async (session) => {
      const [productions, episodes] = await Promise.all([
        mongoCollection("productions"), mongoCollection("episodes"),
      ]);
      const production = await productions.findOne({ id: productionId }, { session });
      if (!production) { const error = new Error("Production not found"); error.status = 404; throw error; }
      if (await episodes.findOne({ production_id: productionId, episode_number: episodeNumber }, { session })) {
        const error = new Error("Episode number already exists"); error.status = 409; throw error;
      }
      const id = await nextNumericId("episodes");
      await episodes.insertOne({ _id: id, id, production_id: productionId,
        episode_number: episodeNumber, title, video_url: videoUrl, duration,
        thumbnail_url: thumbnailUrl, intro_start: null, intro_end: null,
        preview_enabled: 0, views_count: 0, created_at: new Date(), updated_at: new Date() }, { session });
      if (videoUrl) await queueEpisodeNotification({ episodeId: id, productionId, batchId, batchComplete, session });
      return { id, productionId, episodeNumber, title };
    });
    return res.status(201).json(result);
  }
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
