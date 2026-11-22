import dotenv from "dotenv";
import { closeMongo, mongoCollection } from "../src/core/database/mongo.js";
import { resolveWatchProgress } from "../src/modules/streaming/watch-progress.js";

dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url), override: false });

try {
  const history = await (await mongoCollection("watch_history")).find({}).toArray();
  const episodes = await (await mongoCollection("episodes"))
    .find({ id: { $in: [...new Set(history.map((item) => item.episode_id))] } }).toArray();
  const episodeById = new Map(episodes.map((episode) => [episode.id, episode]));
  const repairs = history.flatMap((item) => {
    const episode = episodeById.get(item.episode_id);
    const progress = resolveWatchProgress({
      position: item.last_position,
      duration: episode?.duration,
      completed: Number(item.is_completed) === 1,
    });
    const alreadyCorrect = Number(item.is_completed) === (progress.completed ? 1 : 0)
      && Number(item.watched_percent) === progress.watchedPercent
      && Number(item.last_position) === progress.position;
    if (!progress.completed || alreadyCorrect) return [];
    return [{ updateOne: {
      filter: { _id: item._id },
      update: { $set: {
        last_position: progress.position,
        watched_percent: progress.watchedPercent,
        is_completed: 1,
      } },
    } }];
  });
  if (repairs.length) await (await mongoCollection("watch_history")).bulkWrite(repairs);
  console.log(`Repaired watch history rows: ${repairs.length}`);
} finally {
  await closeMongo();
}
