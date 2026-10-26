import prisma from "../../../core/database/prisma.js";
import { uploadFileToR2 } from "../../../core/storage/upload.helper.js";
import axios from "axios";

export const getEpisodesBySeasonService = async (seasonId) => {
  return await prisma.episodes.findMany({
    where: { production_id: Number(seasonId) },
    orderBy: { episode_number: "asc" },
  });
};

export const createSeasonService = async (seriesId, data) => {
  const { season_number } = data;
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
      .post("http://video_service:8001/process-video", {
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
      .post("http://video_service:8001/process-video", {
        file_name: videoUrl,
        production_id: episode.production_id,
        episode_id: episode.id,
      })
      .catch((e) => console.error("Lỗi gọi Python Service:", e.message));
  }
  return episode;
};

export const deleteEpisodeService = async (id) => {
  return await prisma.episodes.delete({ where: { id: Number(id) } });
};

export const updateVideoWebhookService = async (
  production_id,
  episode_id,
  m3u8_url,
) => {
  if (!episode_id) throw new Error("Thiếu episode_id từ Webhook!");

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
