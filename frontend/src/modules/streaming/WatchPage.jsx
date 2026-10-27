import { Spin } from "antd";

import VideoPlayer from "../../components/streamingPage/VideoPlayer";
import EpisodeSelector from "../../components/streamingPage/EpisodeSelector";
import MovieInfo from "../../components/streamingPage/MovieInfo";
import SeasonSelector from "../../components/streamingPage/SeasonSelector";
import CommentSection from "../../components/streamingPage/CommentSection";
import RecommendedList from "../../components/streamingPage/RecommendedList";
import RelatedMovies from "../../components/streamingPage/RelatedMovies";
import { useWatchPage } from "../../hooks/streaming/useWatchPage";

const WatchPage = () => {
  const {
    loading,
    productionData,
    currentEpisode,
    currentSeasonId,
    episodeList,
    playerSettings,
    setPlayerSettings,
    isLightOff,
    setLightOff,
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
      <div className="min-h-screen bg-[#121212] text-gray-300 font-sans pb-10 relative pt-12">
        {/* Light Off Overlay */}
        <div
          className={`fixed inset-0 bg-black/95 z-40 transition-opacity duration-500 pointer-events-none ${isLightOff ? "opacity-100" : "opacity-0"}`}
        ></div>

        <div className="container mx-auto px-2 md:px-4 max-w-[1600px] pt-[20px]">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* DANH SÁCH TẬP  */}
            <div
              className={`xl:col-span-2 order-2 xl:order-1 transition-opacity duration-300 ${isLightOff ? "opacity-10" : "opacity-100"}`}
            >
              <div className="sticky top-4 h-[500px] xl:h-[calc(100vh-100px)]">
                <EpisodeSelector
                  episodes={episodeList}
                  currentEpisodeId={currentEpisode?.id}
                  onEpisodeClick={handleChangeEpisode}
                />
              </div>
            </div>

            {/* VIDEO PLAYER & SEASONS  */}
            <div className="xl:col-span-7 order-1 xl:order-2 relative z-50">
              {/* 1. Video Player */}
              {currentEpisode ? (
                <VideoPlayer
                  currentEpisode={currentEpisode}
                  isLightOff={isLightOff}
                  setLightOff={setLightOff}
                  onNextEpisode={handleNextEpisode}
                  settings={playerSettings}
                  setSettings={setPlayerSettings}
                />
              ) : (
                <div className="aspect-video bg-black flex items-center justify-center text-gray-500">
                  Chưa có tập phim nào
                </div>
              )}

              {/* 2. Season Selector (tự ẩn nếu là Movie) */}
              <div
                className={`transition-opacity duration-300 ${isLightOff ? "opacity-20 hover:opacity-100" : "opacity-100"}`}
              >
                <SeasonSelector
                  currentSeasonId={currentSeasonId}
                  seasons={productionData.seasons}
                  productionType={productionData.type}
                  onSeasonClick={handleChangeSeason}
                />
              </div>
            </div>

            {/* THÔNG TIN PHIM */}
            <div
              className={`xl:col-span-3 order-3 xl:order-3 transition-opacity duration-300 ${isLightOff ? "opacity-10" : "opacity-100"}`}
            >
              <MovieInfo production={productionData} />
            </div>
          </div>

          {/* === BÌNH LUẬN & ĐỀ XUẤT === */}
          <div
            className={`mt-8 grid grid-cols-1 xl:grid-cols-12 gap-6 transition-opacity duration-300 ${isLightOff ? "opacity-10" : "opacity-100"}`}
          >
            <div className="xl:col-span-9">
              <CommentSection />
            </div>

            <div className="xl:col-span-3">
              <RecommendedList list={related} />
            </div>
          </div>
          {/* === GỢI Ý PHIM LIÊN QUAN === */}
          <div className="border-t border-gray-800 mt-10 pt-6">
            <RelatedMovies movies={relatedMoviesData} />
          </div>
        </div>
      </div>
    </>
  );
};

export default WatchPage;
