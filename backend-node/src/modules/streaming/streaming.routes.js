import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { fromMongo, mongoCollection } from "../../core/database/mongo.js";
import { requireAuth, optionalAuth } from "../../core/middleware/business-auth.bridge.js";
import { asyncHandler, parsePositiveInt } from "../../core/utils/http.js";
import { applyEpisodeAccess, resolveProductionPremium } from "./playback-access.js";
import { selectContinueWatching } from "./continue-watching.js";

export const streamingRouter = Router();

streamingRouter.get("/episodes/:episodeId", optionalAuth, asyncHandler(async (req, res) => {
  const episodeId = parsePositiveInt(req.params.episodeId, "episode id");
  if (process.env.DATA_STORE === "mongodb") {
    const episode = await (await mongoCollection("episodes")).findOne({ id: episodeId });
    if (!episode) return res.status(404).json({ message: "Episode not found" });
    const production = await (await mongoCollection("productions")).findOne({ id: episode.production_id });
    if (!production) return res.status(404).json({ message: "Episode not found" });
    const season = await (await mongoCollection("seasons")).findOne({ id: episode.production_id });
    const premium = await resolveProductionPremium(production.id);
    return res.json(applyEpisodeAccess({ ...fromMongo(episode),
      production_title: production.title, production_id: production.id,
      watch_production_id: season?.series_id ?? production.id,
      season_number: season?.season_number ?? null,
      slug: production.slug, poster_url: production.poster_url,
      is_premium: production.is_premium }, { premium, user: req.user }));
  }
  const [items] = await pool.execute(
    `SELECT e.*, p.title AS production_title, p.id AS production_id, p.slug, p.poster_url,
            COALESCE(s.series_id, p.id) AS watch_production_id, s.season_number,
            p.is_premium, sp.is_premium AS series_premium
       FROM episodes e
       JOIN productions p ON p.id = e.production_id
       LEFT JOIN seasons s ON s.id = p.id
       LEFT JOIN productions sp ON sp.id = s.series_id
      WHERE e.id = ?`,
    [episodeId],
  );
  if (!items.length) return res.status(404).json({ message: "Episode not found" });
  const premium = Boolean(items[0].is_premium) || Boolean(items[0].series_premium);
  const episode = applyEpisodeAccess(items[0], { premium, user: req.user });
  delete episode.series_premium;
  res.json(episode);
}));

streamingRouter.get("/history", requireAuth, asyncHandler(async (req, res) => {
  if (process.env.DATA_STORE === "mongodb") {
    const history = await (await mongoCollection("watch_history"))
      .find({ user_id: req.user.id }).sort({ last_watched_at: -1 }).toArray();
    const episodes = await (await mongoCollection("episodes"))
      .find({ id: { $in: history.map((item) => item.episode_id) } }).toArray();
    const productions = await (await mongoCollection("productions"))
      .find({ id: { $in: episodes.map((item) => item.production_id) } }).toArray();
    const episodeMap = new Map(episodes.map((item) => [item.id, item]));
    const productionMap = new Map(productions.map((item) => [item.id, item]));
    const seasons = await (await mongoCollection("seasons")).find({ id: { $in: episodes.map((item) => item.production_id) } }).toArray();
    const seasonMap = new Map(seasons.map((item) => [item.id, item]));
    const items = history.flatMap((row) => {
      const episode = episodeMap.get(row.episode_id);
      const production = episode && productionMap.get(episode.production_id);
      return episode && production ? [{ episode_id: row.episode_id,
        last_position: row.last_position, watched_percent: fromMongo(row.watched_percent),
        watched_duration: row.watched_duration, is_completed: row.is_completed,
        last_watched_at: row.last_watched_at, episode_number: episode.episode_number,
        episode_title: episode.title, duration: episode.duration,
        thumbnail_url: episode.thumbnail_url, production_id: production.id,
        watch_production_id: seasonMap.get(production.id)?.series_id ?? production.id,
        season_number: seasonMap.get(production.id)?.season_number ?? null,
        title: production.title, slug: production.slug, poster_url: production.poster_url }] : [];
    });
    return res.json({ items, continueWatching: selectContinueWatching(items) });
  }
  const [items] = await pool.execute(`SELECT wh.episode_id, wh.last_position, wh.watched_percent, wh.watched_duration, wh.is_completed, wh.last_watched_at, e.episode_number, e.title AS episode_title, e.duration, e.thumbnail_url, p.id AS production_id, COALESCE(s.series_id,p.id) AS watch_production_id, s.season_number, p.title, p.slug, p.poster_url FROM watch_history wh JOIN episodes e ON e.id=wh.episode_id JOIN productions p ON p.id=e.production_id LEFT JOIN seasons s ON s.id=p.id WHERE wh.user_id=? ORDER BY wh.last_watched_at DESC`, [req.user.id]);

  // "Xem tiếp" chỉ lấy tập gần nhất của mỗi phim đang xem dở.
  // Một phim bộ có thể có nhiều tập trong lịch sử nên phải khử trùng theo production_id.
  const continueWatching = selectContinueWatching(items);

  res.json({ items, continueWatching });
}));

streamingRouter.put("/history/:episodeId", requireAuth, asyncHandler(async (req, res) => {
  const episodeId = parsePositiveInt(req.params.episodeId, "episode id");
  const position = Math.max(0, Math.floor(Number(req.body.position)));
  if (!Number.isFinite(position)) return res.status(400).json({ message: "position must be a non-negative number" });
  if (process.env.DATA_STORE === "mongodb") {
    const episodes = await mongoCollection("episodes");
    const episode = await episodes.findOne({ id: episodeId });
    if (!episode) return res.status(404).json({ message: "Episode not found" });
    const duration = Number(episode.duration);
    const safePosition = Math.min(position, duration);
    const watchedPercent = duration ? Math.min(100, safePosition / duration * 100) : 0;
    const completed = watchedPercent >= 90;
    const history = await mongoCollection("watch_history");
    await history.updateOne({ user_id: req.user.id, episode_id: episodeId }, {
      $set: { last_position: safePosition, watched_percent: watchedPercent,
        is_completed: Number(completed), last_watched_at: new Date() },
      $max: { watched_duration: safePosition },
      $setOnInsert: { _id: { user_id: req.user.id, episode_id: episodeId },
        user_id: req.user.id, episode_id: episodeId },
    }, { upsert: true });
    return res.json({ episodeId, position: safePosition, watchedPercent, completed });
  }
  const [episodes] = await pool.execute("SELECT id, duration FROM episodes WHERE id=?", [episodeId]);
  if (!episodes.length) return res.status(404).json({ message: "Episode not found" });
  const duration = Number(episodes[0].duration);
  const safePosition = Math.min(position, duration);
  const watchedPercent = duration ? Math.min(100, (safePosition / duration) * 100) : 0;
  const completed = watchedPercent >= 90;
  await pool.execute(`INSERT INTO watch_history (user_id, episode_id, last_position, watched_percent, watched_duration, is_completed) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_position=VALUES(last_position), watched_percent=VALUES(watched_percent), watched_duration=GREATEST(watched_duration, VALUES(watched_duration)), is_completed=VALUES(is_completed), last_watched_at=CURRENT_TIMESTAMP`, [req.user.id, episodeId, safePosition, watchedPercent, safePosition, completed]);
  res.json({ episodeId, position: safePosition, watchedPercent, completed });
}));

streamingRouter.delete("/history/:episodeId", requireAuth, asyncHandler(async (req, res) => {
  const episodeId = parsePositiveInt(req.params.episodeId, "episode id");
  if (process.env.DATA_STORE === "mongodb") {
    await (await mongoCollection("watch_history")).deleteOne({ user_id: req.user.id, episode_id: episodeId });
    return res.status(204).end();
  }
  await pool.execute("DELETE FROM watch_history WHERE user_id=? AND episode_id=?", [req.user.id, episodeId]);
  res.status(204).end();
}));

streamingRouter.delete("/history", requireAuth, asyncHandler(async (req, res) => {
  if (process.env.DATA_STORE === "mongodb") {
    await (await mongoCollection("watch_history")).deleteMany({ user_id: req.user.id });
    return res.status(204).end();
  }
  await pool.execute("DELETE FROM watch_history WHERE user_id=?", [req.user.id]);
  res.status(204).end();
}));
