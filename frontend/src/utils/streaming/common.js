import { getEpisodesBySeason } from "../../services/movieService";

export const calcDurationDisplay = (production) => {
  const durationDisplay =
    production.type === "movie"
      ? production.movies?.duration >= 60
        ? `${Math.floor((production.movies?.duration || 0) / 60)} phút`
        : `${production.movies?.duration || 0} giây`
      : `${production.series?.total_seasons || 0} Seasons`;

  return durationDisplay;
};

export const createWatchNowUrl = (production) => {
  let firstEpLink = "";

  if (production.type === "movie") {
    // Nếu là Movie: Chỉ cần ?ep=1
    firstEpLink = `/watch/${production.slug}?ep=1`;
  } else {
    // Nếu là Series: Cần thêm ?ss=X&ep=1
    const firstSeasonNum = production.seasons?.[0]?.season_number || 1;
    firstEpLink = `/watch/${production.slug}?ss=${firstSeasonNum}&ep=1`;
  }
  return firstEpLink;
};

export const calcTargetSeasonIdAndTargetEpisodes = (
  data,
  currentSeasonParam,
) => {
  let targetSeasonId = null;
  let targetEpisodes = [];

  // Logic xử lý Series/Season
  if (data.production.type === "series") {
    // 1. Tìm season từ URL
    if (currentSeasonParam) {
      const foundSeason = data.production.seasons.find(
        (s) => s.season_number.toString() === currentSeasonParam,
      );
      if (foundSeason) targetSeasonId = foundSeason.id;
    }

    // 2. Fallback nếu không có trên URL
    if (!targetSeasonId) {
      targetSeasonId =
        data.production.seasons?.find((s) => s.is_active)?.id ||
        data.production.seasons?.[0]?.id;
    }

    // 3. Fetch episodes nếu cần
    const defaultLoadedSeasonId =
      data.production.seasons?.find((s) => s.is_active)?.id ||
      data.production.seasons?.[0]?.id;

    if (targetSeasonId !== defaultLoadedSeasonId) {
      const res = getEpisodesBySeason(targetSeasonId);
      targetEpisodes = res.data;
    } else {
      targetEpisodes = data.episodes;
    }
  } else {
    // Movie
    targetEpisodes = data.episodes;
  }
  return { targetEpisodes, targetSeasonId };
};
