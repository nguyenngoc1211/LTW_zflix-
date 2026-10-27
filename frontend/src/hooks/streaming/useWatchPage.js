import { useEffect, useState } from "react";
import { message } from "antd";
import { useParams, useSearchParams } from "react-router-dom";

import {
  getEpisodesBySeason,
  getMovieBySlug,
} from "../../services/movieService";
import { calcTargetSeasonIdAndTargetEpisodes } from "../../utils/streaming/common";
import { getFallbackVideoUrl } from "../../utils/streaming/fallbackUrl";

export const useWatchPage = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();

  const currentEpNumber = searchParams.get("ep");
  const currentSeasonParam = searchParams.get("ss");

  const [loading, setLoading] = useState(true);
  const [productionData, setProductionData] = useState(null);
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [currentSeasonId, setCurrentSeasonId] = useState(null);
  const [episodeList, setEpisodeList] = useState([]);

  const [playerSettings, setPlayerSettings] = useState({
    autoPlay: true,
    autoNext: true,
    autoSkipIntro: false,
  });
  const [isLightOff, setLightOff] = useState(false);

  // --- EFFECT 1: FETCH INITIAL DATA ---
  useEffect(() => {
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    getMovieBySlug(slug)
      .then((production) => {
        setProductionData(production);

        const mappedData = {
          production: production,
          episodes: production.episodes || [],
        };

        let { targetSeasonId, targetEpisodes } =
          calcTargetSeasonIdAndTargetEpisodes(mappedData, currentEpNumber);

        const currentSeason = production.seasons?.find((s) => s.id === targetSeasonId);
        const seasonNumber = currentSeason?.season_number || 1;

        targetEpisodes = targetEpisodes.map((ep) => ({
          ...ep,
          video_url: getFallbackVideoUrl(
            ep.video_url,
            production.type,
            seasonNumber,
            ep.episode_number
          ),
        }));

        setCurrentSeasonId(targetSeasonId);
        setEpisodeList(targetEpisodes);

        if (currentEpNumber) {
          const foundEp = targetEpisodes.find(
            (e) => e.episode_number.toString() === currentEpNumber.toString(),
          );
          if (foundEp) setCurrentEpisode(foundEp);
          else setCurrentEpisode(targetEpisodes[0]);
        } else {
          setCurrentEpisode(targetEpisodes[0]);
        }
      })
      .catch((err) => {
        console.error(err);
        messageApi.error("Không thể tải phim!");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  // --- EFFECT 2: SYNC EPISODE FROM URL ---
  useEffect(() => {
    if (episodeList.length > 0 && currentEpNumber) {
      const foundEp = episodeList.find(
        (e) => e.episode_number.toString() === currentEpNumber.toString(),
      );
      if (foundEp && foundEp.id !== currentEpisode?.id) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentEpisode(foundEp);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [currentEpNumber, episodeList]);

  // --- HANDLERS ---

  const handleChangeEpisode = (episode) => {
    setCurrentEpisode(episode);
    window.scrollTo({ top: 0, behavior: "smooth" });
    messageApi.success(`Đang phát tập ${episode.episode_number}`);

    // Update URL chuẩn
    if (productionData.type === "series") {
      setSearchParams({
        ss: currentSeasonParam,
        ep: episode.episode_number,
      });
    } else {
      setSearchParams({ ep: episode.episode_number });
    }
  };

  const handleChangeSeason = (seasonId) => {
    if (seasonId === currentSeasonId) return;

    setLoading(true);
    setTimeout(async () => {
      const selectedSeason = productionData.seasons.find(
        (s) => s.id === seasonId,
      );
      const newSeasonNum = selectedSeason?.season_number || 1;

      try {
        let newEpisodes = Array.isArray(productionData.episodes) 
          ? productionData.episodes.filter(ep => ep.season_id === seasonId)
          : [];

        if (newEpisodes.length === 0) {
           const res = await getEpisodesBySeason(seasonId);
           newEpisodes = res.data || [];
        }

        newEpisodes = newEpisodes.map(ep => ({
          ...ep,
          video_url: getFallbackVideoUrl(ep.video_url, productionData.type, newSeasonNum, ep.episode_number)
        }));

        setEpisodeList(newEpisodes);
        setCurrentSeasonId(seasonId);

        if (newEpisodes.length > 0) {
          const firstEp = newEpisodes[0];
          setCurrentEpisode(firstEp);
          setSearchParams({
            ss: newSeasonNum,
            ep: firstEp.episode_number,
          });
        } else {
          setCurrentEpisode(null);
          setSearchParams({ ss: newSeasonNum });
        }

        messageApi.info(`Đã chuyển sang Mùa ${newSeasonNum}`);
      } catch (err) {
        console.error(err);
        messageApi.error("Không thể tải tập phim của mùa này.");
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleNextEpisode = () => {
    const currentIndex = episodeList.findIndex(
      (ep) => ep.id === currentEpisode.id,
    );
    if (currentIndex !== -1 && currentIndex < episodeList.length - 1) {
      const nextEp = episodeList[currentIndex + 1];
      handleChangeEpisode(nextEp);
    } else {
      messageApi.warning("Đây là tập cuối của mùa này rồi!");
    }
  };

  // Trả về tất cả dữ liệu và hàm cần thiết cho View
  return {
    loading,
    productionData,
    currentEpisode,
    currentSeasonId,
    episodeList,
    playerSettings,
    setPlayerSettings,
    isLightOff,
    setLightOff,
    contextHolder,
    handlers: {
      handleChangeEpisode,
      handleChangeSeason,
      handleNextEpisode,
    },
  };
};
