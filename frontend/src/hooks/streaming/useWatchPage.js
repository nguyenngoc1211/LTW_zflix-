import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import { useParams, useSearchParams } from "react-router-dom";

import { apiRequest } from "../../services/api.js";
import {
  getEpisodesBySeason,
  getMovieById,
  getMovieBySlug,
} from "../../services/movieService";
import { calcTargetSeasonIdAndTargetEpisodes } from "../../utils/streaming/common";

export const useWatchPage = () => {
  const { id } = useParams();
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

  // --- EFFECT 1: FETCH INITIAL DATA ---
  useEffect(() => {
    let active = true;
    window.scrollTo(0, 0);
    setLoading(true);

    getMovieById(id)
      .then((base) => getMovieBySlug(base.slug))
      .then(async (production) => {
        if (!active) return;
        setProductionData(production);

        const mappedData = {
          production: production,
          episodes: production.episodes || [],
        };

        let { targetSeasonId, targetEpisodes } =
          await calcTargetSeasonIdAndTargetEpisodes(
            mappedData,
            currentSeasonParam,
          );
        if (!active) return;
        targetEpisodes = targetEpisodes || [];

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
        if (!active) return;
        console.error(err);
        messageApi.error("Không thể tải phim!");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, currentSeasonParam, currentEpNumber, messageApi]);

  // --- HANDLERS ---

  const handleChangeEpisode = (episode) => {
    setCurrentEpisode(episode);
    window.scrollTo({ top: 0, behavior: "smooth" });
    messageApi.success(`Đang phát tập ${episode.episode_number}`);

    // Update URL chuẩn
    if (productionData.type === "series") {
      const seasonNumber =
        productionData.seasons?.find((s) => s.id === currentSeasonId)
          ?.season_number ??
        currentSeasonParam ??
        1;
      setSearchParams({
        ss: seasonNumber,
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
           newEpisodes = Array.isArray(res) ? res : res?.data || [];
        }

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

  // Lưu vị trí xem vào lịch sử (giống PlayerPage): mỗi 10 giây một lần.
  const lastSavedRef = useRef({ episodeId: null, position: 0 });
  const handleTimeUpdate = useCallback(
    (seconds) => {
      const episodeId = currentEpisode?.id;
      if (!episodeId) return;
      if (lastSavedRef.current.episodeId !== episodeId) lastSavedRef.current = { episodeId, position: 0 };
      if (seconds <= 0 || Math.abs(seconds - lastSavedRef.current.position) < 10) return;
      lastSavedRef.current.position = seconds;
      apiRequest(`/api/v1/history/${episodeId}`, {
        method: "PUT",
        body: JSON.stringify({ position: seconds }),
      }).catch(() => {});
    },
    [currentEpisode],
  );

  // Trả về tất cả dữ liệu và hàm cần thiết cho View
  return {
    loading,
    productionData,
    currentEpisode,
    currentSeasonId,
    episodeList,
    playerSettings,
    setPlayerSettings,
    contextHolder,
    handlers: {
      handleChangeEpisode,
      handleChangeSeason,
      handleNextEpisode,
      handleTimeUpdate,
    },
  };
};
