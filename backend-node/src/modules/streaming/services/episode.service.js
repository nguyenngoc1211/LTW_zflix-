import prisma from "../../../core/database/prisma.js";
import { uploadFileToR2 } from "../../../core/storage/upload.helper.js";
import { videoServiceProcessEndpoint } from "../../../config/video-service.config.js";
import { applyEpisodeAccess, resolveProductionPremium } from "../playback-access.js";
import axios from "axios";
import { fromMongo, mongoCollection, nextNumericId, withMongoTransaction } from "../../../core/database/mongo.js";
import { queueEpisodeNotification } from '../../community/episode-notification.job.js';

export const getEpisodesBySeasonService = async (seasonId, viewer = null) => {
  const premium = await resolveProductionPremium(Number(seasonId));
  if (process.env.DATA_STORE === "mongodb") {
    const episodes = await (await mongoCollection("episodes"))
      .find({ production_id: Number(seasonId) }).sort({ episode_number: 1 }).toArray();
    return episodes.map((episode) => applyEpisodeAccess(fromMongo(episode), { premium, user: viewer }));
  }
  const episodes = await prisma.episodes.findMany({
    where: { production_id: Number(seasonId) },
    orderBy: { episode_number: "asc" },
  });
  return episodes.map((episode) => applyEpisodeAccess(episode, { premium, user: viewer }));
};

export const createSeasonService = async (seriesId, data) => {
  const { season_number } = data;
  if (process.env.DATA_STORE === "mongodb") {
    const id = await nextNumericId("productions");
    const seriesIdNumber = Number(seriesId);
    const seasonNumber = Number(season_number);
    return withMongoTransaction(async (session) => {
      const series = await (await mongoCollection("series"))
        .findOne({ id: seriesIdNumber }, { session });
      if (!series) throw new Error("Series not found");
      await (await mongoCollection("productions")).insertOne({ _id: id, id,
        type: "season", title: `Mùa ${seasonNumber}`,
        slug: `series-${seriesId}-season-${seasonNumber}-${Date.now()}`,
        is_premium: 0, status: "ongoing", rating_avg: 0, rating_count: 0,
        created_at: new Date(), updated_at: new Date() }, { session });
      const season = { _id: id, id, series_id: seriesIdNumber, season_number: seasonNumber };
      await (await mongoCollection("seasons")).insertOne(season, { session });
      await (await mongoCollection("series")).updateOne({ id: seriesIdNumber },
        { $inc: { total_seasons: 1 } }, { session });
      return fromMongo(season);
    });
  }
  return await prisma.$transaction(async (tx) => {
    const seasonProd = await tx.productions.create({
      data: {
        type: "season",
        title: `Mùa ${season_number}`,
        slug: `series-${seriesId}-season-${season_number}-${Date.now()}`,
      },
    });

    const season = await tx.seasons.create({
      data: {
        id: seasonProd.id,
        series_id: Number(seriesId),
        season_number: Number(season_number),
      },
    });

    await tx.series.update({
      where: { id: Number(seriesId) },
      data: { total_seasons: { increment: 1 } },
    });

    return season;
  });
};

export const createEpisodeService = async (data, file) => {
  let videoUrl = data.video_url || null;
  if (file) {
    videoUrl = await uploadFileToR2(file, "raw/episodes");
  }

  if (process.env.DATA_STORE === "mongodb") {
    const productionId = Number(data.production_id);
    const production = await (await mongoCollection("productions")).findOne({ id: productionId });
    if (!production) throw new Error("Production not found");
    const id = await nextNumericId("episodes");
    const episode = { _id: id, id, production_id: productionId,
      episode_number: Number(data.episode_number), title: data.title,
      duration: Number(data.duration || 0), thumbnail_url: data.thumbnail_url || null,
      video_url: videoUrl, notification_pending: Boolean(file), created_at: new Date() };
    await (await mongoCollection("episodes")).insertOne(episode);
    if (videoUrl && !file) await queueEpisodeNotification({ episodeId: id, productionId });
    if (file && videoUrl) axios.post(videoServiceProcessEndpoint, {
      file_name: videoUrl, production_id: productionId, episode_id: id,
    }).catch((error) => console.error("Lỗi gọi Python Service:", error.message));
    return fromMongo(episode);
  }

  const episode = await prisma.episodes.create({
    data: {
      production_id: Number(data.production_id),
      episode_number: Number(data.episode_number),
      title: data.title,
      duration: Number(data.duration || 0),
      thumbnail_url: data.thumbnail_url || null,
      video_url: videoUrl,
    },
  });

  if (file && videoUrl) {
    axios
      .post(videoServiceProcessEndpoint, {
        file_name: videoUrl,
        production_id: episode.production_id,
        episode_id: episode.id,
      })
      .catch((e) => console.error("Lỗi gọi Python Service:", e.message));
  }
  return episode;
};

export const updateEpisodeService = async (id, data, file) => {
  let videoUrl = data.video_url;

  if (file) {
    videoUrl = await uploadFileToR2(file, "raw/episodes");
  }

  if (process.env.DATA_STORE === "mongodb") {
    const updates = { updated_at: new Date() };
    if (data.episode_number) updates.episode_number = Number(data.episode_number);
    if (data.title !== undefined) updates.title = data.title;
    if (data.duration) updates.duration = Number(data.duration);
    if (data.thumbnail_url !== undefined) updates.thumbnail_url = data.thumbnail_url;
    if (videoUrl !== undefined) updates.video_url = videoUrl;
    const episodes = await mongoCollection("episodes");
    const result = await episodes.updateOne({ id: Number(id) }, { $set: updates });
    if (!result.matchedCount) throw new Error("Episode not found");
    const episode = await episodes.findOne({ id: Number(id) });
    if (file && videoUrl) axios.post(videoServiceProcessEndpoint, {
      file_name: videoUrl, production_id: episode.production_id, episode_id: episode.id,
    }).catch((error) => console.error("Lỗi gọi Python Service:", error.message));
    return fromMongo(episode);
  }

  const updateData = {
    episode_number: data.episode_number
      ? Number(data.episode_number)
      : undefined,
    title: data.title,
    duration: data.duration ? Number(data.duration) : undefined,
    thumbnail_url: data.thumbnail_url !== undefined ? data.thumbnail_url : undefined,
    updated_at: new Date(),
  };

  if (videoUrl !== undefined) updateData.video_url = videoUrl;

  const episode = await prisma.episodes.update({
    where: { id: Number(id) },
    data: updateData,
  });

  if (file && videoUrl) {
    axios
      .post(videoServiceProcessEndpoint, {
        file_name: videoUrl,
        production_id: episode.production_id,
        episode_id: episode.id,
      })
      .catch((e) => console.error("Lỗi gọi Python Service:", e.message));
  }
  return episode;
};

export const deleteEpisodeService = async (id) => {
  if (process.env.DATA_STORE === "mongodb") {
    const episodeId = Number(id);
    return withMongoTransaction(async (session) => {
      const episodes = await mongoCollection("episodes");
      const episode = await episodes.findOne({ id: episodeId }, { session });
      if (!episode) throw new Error("Episode not found");
      const parties = await (await mongoCollection("watch_parties"))
        .find({ episode_id: episodeId }, { session }).toArray();
      const partyIds = parties.map((party) => party.id);
      await (await mongoCollection("watch_party_chats")).deleteMany({ party_id: { $in: partyIds } }, { session });
      await (await mongoCollection("watch_party_participants")).deleteMany({ party_id: { $in: partyIds } }, { session });
      await (await mongoCollection("watch_parties")).deleteMany({ id: { $in: partyIds } }, { session });
      await (await mongoCollection("watch_history")).deleteMany({ episode_id: episodeId }, { session });
      await (await mongoCollection("product_snapshots")).deleteMany({ episode_id: episodeId }, { session });
      await (await mongoCollection("production_products")).deleteMany({ episode_id: episodeId }, { session });
      await episodes.deleteOne({ id: episodeId }, { session });
      return fromMongo(episode);
    });
  }
  return await prisma.episodes.delete({ where: { id: Number(id) } });
};

export const updateVideoWebhookService = async (
  production_id,
  episode_id,
  m3u8_url,
) => {
  if (!episode_id) throw new Error("Thiếu episode_id từ Webhook!");

  if (process.env.DATA_STORE === "mongodb") {
    await withMongoTransaction(async (session) => {
      const previous = await (await mongoCollection('episodes')).findOne({ id: Number(episode_id), production_id: Number(production_id) }, { session });
      const episode = await (await mongoCollection("episodes")).updateOne({ id: Number(episode_id) },
        { $set: { video_url: m3u8_url, notification_pending: false } }, { session });
      const production = await (await mongoCollection("productions"))
        .updateOne({ id: Number(production_id) }, { $set: { status: "completed" } }, { session });
      if (!episode.matchedCount || !production.matchedCount) throw new Error("Episode or production not found");
      if (previous?.notification_pending === true && m3u8_url) await queueEpisodeNotification({ episodeId: Number(episode_id), productionId: Number(production_id), session });
    });
    return true;
  }

  await prisma.$transaction([
    prisma.episodes.update({
      where: { id: Number(episode_id) },
      data: { video_url: m3u8_url },
    }),
    prisma.productions.update({
      where: { id: Number(production_id) },
      data: { status: "completed" },
    }),
  ]);
  return true;
};
