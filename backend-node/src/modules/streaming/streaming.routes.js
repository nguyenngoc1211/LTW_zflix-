import { Router } from "express";
import { pool } from "../../core/database/pool.js";
import { requireAuth, optionalAuth } from "../../core/middleware/business-auth.bridge.js";
import { asyncHandler, parsePositiveInt } from "../../core/utils/http.js";
import { applyEpisodeAccess } from "./playback-access.js";
import { selectContinueWatching } from "./continue-watching.js";

export const streamingRouter = Router();

streamingRouter.get("/episodes/:episodeId", optionalAuth, asyncHandler(async (req, res) => {
  const episodeId = parsePositiveInt(req.params.episodeId, "episode id");
  const [items] = await pool.execute(
    `SELECT e.*, p.title AS production_title, p.id AS production_id, p.slug, p.poster_url,
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
  const [items] = await pool.execute(`SELECT wh.episode_id, wh.last_position, wh.watched_percent, wh.watched_duration, wh.is_completed, wh.last_watched_at, e.episode_number, e.title AS episode_title, e.duration, e.thumbnail_url, p.id AS production_id, p.title, p.slug, p.poster_url FROM watch_history wh JOIN episodes e ON e.id=wh.episode_id JOIN productions p ON p.id=e.production_id WHERE wh.user_id=? ORDER BY wh.last_watched_at DESC`, [req.user.id]);

  // "Xem tiếp" chỉ lấy tập gần nhất của mỗi phim đang xem dở.
  // Một phim bộ có thể có nhiều tập trong lịch sử nên phải khử trùng theo production_id.
  const continueWatching = selectContinueWatching(items);

  res.json({ items, continueWatching });
}));

streamingRouter.put("/history/:episodeId", requireAuth, asyncHandler(async (req, res) => {
  const episodeId = parsePositiveInt(req.params.episodeId, "episode id");
  const position = Math.max(0, Math.floor(Number(req.body.position)));
  if (!Number.isFinite(position)) return res.status(400).json({ message: "position must be a non-negative number" });
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
  await pool.execute("DELETE FROM watch_history WHERE user_id=? AND episode_id=?", [req.user.id, episodeId]);
  res.status(204).end();
}));

streamingRouter.delete("/history", requireAuth, asyncHandler(async (req, res) => {
  await pool.execute("DELETE FROM watch_history WHERE user_id=?", [req.user.id]);
  res.status(204).end();
}));
