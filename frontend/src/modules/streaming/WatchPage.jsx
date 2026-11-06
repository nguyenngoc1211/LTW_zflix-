import { Spin } from "antd";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { parseWatchPosition } from "../../utils/streaming/watchUrl.js";

import VideoPlayer from "../../components/streamingPage/VideoPlayer";
import EpisodeSelector from "../../components/streamingPage/EpisodeSelector";
import MovieInfo from "../../components/streamingPage/MovieInfo";
import SeasonSelector from "../../components/streamingPage/SeasonSelector";
import MovieDiscussion from "../../components/streamingPage/MovieDiscussion";
import RecommendedList from "../../components/streamingPage/RecommendedList";
import RelatedMovies from "../../components/streamingPage/RelatedMovies";
import { useWatchPage } from "../../hooks/streaming/useWatchPage";

const WatchPage = () => {
  const [momentsVersion, setMomentsVersion] = useState(0);
  const [theater, setTheater] = useState(false);
  const [searchParams] = useSearchParams();
  const {
    loading,
    productionData,
    currentEpisode,
    currentSeasonId,
    episodeList,
    playerSettings,
    setPlayerSettings,
    handlers,
    contextHolder,
  } = useWatchPage();
  const { handleChangeEpisode, handleChangeSeason, handleNextEpisode } =
    handlers;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Spin size="large" tip="Loading movie..." />
      </div>
    );
  }

  const { related } = productionData;
  const requestedSeason = searchParams.get("ss");
  const seasonMatches = !requestedSeason || productionData.type !== 'series' || String(productionData.seasons?.find((season) => season.id === currentSeasonId)?.season_number) === requestedSeason;
  const requestedPosition = seasonMatches && String(currentEpisode?.episode_number) === searchParams.get("ep") ? parseWatchPosition(searchParams.get("pos")) : null;
  const relatedMoviesData = [
    ...related,
    ...related,
    ...related,
    ...related,
    ...related,
    ...related,
  ];

  return (
    <>
      {contextHolder}
      {theater && (
        <div className="fixed inset-0 z-40 bg-black" aria-hidden="true" />
      )}
      <div className={`min-h-screen ${theater ? "bg-black" : "bg-[#121212]"} text-gray-300 font-sans pb-10 relative pt-12`}>
        <div className="container mx-auto px-2 md:px-4 max-w-[1600px] pt-[20px]">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* DANH SÁCH TẬP  */}
            <div
              className={`watch-episodes xl:col-span-2 order-2 xl:order-1 ${theater ? 'hidden' : ''}`}
            >
              <EpisodeSelector
                  episodes={episodeList}
                  currentEpisodeId={currentEpisode?.id}
                  onEpisodeClick={handleChangeEpisode}
              />
            </div>

            {/* VIDEO PLAYER & SEASONS  */}
            <div className={`${theater ? 'xl:col-span-12 order-1' : 'xl:col-span-7 order-1 xl:order-2'} relative z-50`}>
              {/* 1. Video Player */}
              {currentEpisode ? (
                <VideoPlayer
                  currentEpisode={currentEpisode}
                  theater={theater}
                  onToggleTheater={setTheater}
                  onNextEpisode={handleNextEpisode}
                  settings={playerSettings}
                  setSettings={setPlayerSettings}
                  productionId={productionData?.id ?? currentEpisode.production_id}
                  productionTitle={productionData?.title}
                  onTimeUpdate={handlers.handleTimeUpdate}
                  resumePosition={requestedPosition}
                  onScreenshotPublished={() => setMomentsVersion((value) => value + 1)}
                />
              ) : (
                <div className="aspect-video bg-black flex items-center justify-center text-gray-500">
                  Chưa có tập phim nào
                </div>
              )}

              {/* 2. Season Selector (tự ẩn nếu là Movie) */}
              <div>
                <SeasonSelector
                  currentSeasonId={currentSeasonId}
                  seasons={productionData.seasons}
                  productionType={productionData.type}
                  onSeasonClick={handleChangeSeason}
                />
              </div>
              <div className="watch-discussion">
                <MovieDiscussion key={currentEpisode?.id} productionId={productionData?.id ?? currentEpisode?.production_id} episodeId={currentEpisode?.id} version={momentsVersion} />
              </div>
            </div>

            {/* THÔNG TIN PHIM */}
            <div
              className={`watch-info xl:col-span-3 order-3 xl:order-3 ${theater ? 'hidden' : ''}`}
            >
              <MovieInfo production={productionData} />
              <div className="mt-8"><RecommendedList list={related} /></div>
            </div>
          </div>
          {/* === GỢI Ý PHIM LIÊN QUAN === */}
          <div className={`border-t border-gray-800 mt-10 pt-6 ${theater ? "hidden" : ""}`}>
            <RelatedMovies movies={relatedMoviesData} />
          </div>
        </div>
      </div>
    </>
  );
};

export default WatchPage;
