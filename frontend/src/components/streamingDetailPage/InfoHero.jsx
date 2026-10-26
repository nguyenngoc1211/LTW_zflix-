import { Button } from "antd";
import {
  CheckOutlined,
  PlayCircleFilled,
  PlusOutlined,
  ShareAltOutlined,
  StarFilled,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import AnonymousBanner from "../../assets/anonymousBanner.png";
import {
  GenreTags,
  PremiumTag,
  StatusTag,
  TypeTag,
} from "../adminContent/ProductionTags";
import ActorList from "../../components/adminContent/ActorList";
import DescriptionBox from "../../components/adminContent/DescriptionBox";
import useShareUrl from "../../hooks/streaming/useShareUrl";
import useWatchlist from "../../hooks/streaming/useWatchlist";
import {
  calcDurationDisplay,
  createWatchNowUrl,
} from "../../utils/streaming/common";

const InfoHero = ({ production }) => {
  const { handleCopyUrl, contextHolder } = useShareUrl();
  const { toggleWatchlist, isInWatchlist, loading } = useWatchlist(
    production?.id,
  );
  if (!production) return null;

  console.log(production);

  let firstEpLink = createWatchNowUrl(production);

  const durationDisplay = calcDurationDisplay(production);

  return (
    <>
      {contextHolder}
      <div className="relative w-full bg-[#121212] overflow-hidden min-h-[550px] flex items-center shadow-2xl mb-8 font-sans pt-10">
        {/* 1. BACKGROUND LAYER (Blur & Darken) */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110"
          style={{
            backgroundImage: `url(${production.banner_url || production.poster_url || AnonymousBanner})`,
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/80 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/60 to-transparent"></div>

        {/* 2. CONTENT CONTAINER */}
        <div className="relative z-10 container mx-auto px-4 max-w-[1400px] py-10">
          <div className="flex flex-col md:flex-row gap-10 items-start">
            {/* CỘT TRÁI: POSTER */}
            <div className="flex-shrink-0 mx-auto md:mx-0 relative group">
              <img
                src={production.poster_url}
                alt={production.title}
                className="w-[240px] md:w-[350px] rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.6)] border border-gray-700/50 transition-transform group-hover:scale-105 duration-300"
              />
            </div>

            {/* CỘT GIỮA: INFO CHÍNH */}
            <div className="flex-1 text-gray-300 space-y-4">
              {/* Title */}
              <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight drop-shadow-lg">
                {production.title}
              </h1>

              {/* Tags Row */}
              <div className="flex flex-wrap items-center gap-3">
                <PremiumTag isPremium={production.is_premium} />
                <StatusTag status={production.status} />
                <TypeTag type={production.type} />
                <span className="text-white font-medium flex items-center gap-1 text-sm">
                  <StarFilled className="text-yellow-400" />{" "}
                  {production.rating_avg}
                </span>
                <span className="text-gray-300 text-sm">
                  • {durationDisplay}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 py-2">
                <Link to={firstEpLink}>
                  <Button
                    type="primary"
                    shape="round"
                    size="large"
                    icon={<PlayCircleFilled />}
                    className="!bg-[#ffdd95] !text-[#111] border-none !font-bold px-8 h-12 text-lg shadow-lg shadow-pink-600/30 hover:opacity-85"
                  >
                    Watch now
                  </Button>
                </Link>
                <Button
                  shape="round"
                  size="large"
                  onClick={toggleWatchlist}
                  loading={loading}
                  icon={isInWatchlist ? <CheckOutlined /> : <PlusOutlined />}
                  className={`border-white/20 font-bold px-6 h-12 text-lg backdrop-blur-md ${isInWatchlist ? "bg-red-500/20 text-red-500 hover:!bg-red-500/40 hover:!text-red-400 hover:!border-red-400" : "bg-white/10 text-white hover:!bg-white/20 hover:!text-[#ffdd95] hover:!border-[#ffdd95]"}`}
                >
                  {isInWatchlist ? "In List" : "Add to List"}
                </Button>
                <Button
                  shape="round"
                  size="large"
                  icon={<ShareAltOutlined />}
                  className="bg-white/10 text-white border-white/20 hover:!bg-white/20 hover:!text-[#ffdd95] font-bold px-6 h-12 text-lg backdrop-blur-md hover:!border-[#ffdd95]"
                  onClick={handleCopyUrl}
                >
                  Share
                </Button>
              </div>

              {/* Description */}
              <DescriptionBox description={production.description} />

              {/* Actor List */}
              <h2 className="text-white font-bold text-lg mt-6 mb-2">
                Danh sách diễn viên
              </h2>
              <ActorList actors={production.actors} />
            </div>

            {/* CỘT PHẢI: INFO SIDEBAR */}
            <div className="w-full md:w-[300px] bg-black/20 p-6 rounded-xl border border-white/10 backdrop-blur-md text-sm space-y-3 flex-shrink-0 shadow-xl">
              <div className="border-b border-white/10 pb-2 mb-2">
                <span className="text-white font-bold text-base">Details</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Quốc gia:</span>
                <span className="text-white text-right">
                  {production.country}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Ngôn ngữ:</span>
                <span className="text-white text-right">
                  {production.language || "English"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Ra mắt:</span>
                <span className="text-white text-right">
                  {production.release_year}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trạng thái:</span>
                <span className="text-white text-right capitalize">
                  {production.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Đánh giá:</span>
                <span className="text-white text-right">
                  {production.rating_avg} ({production.rating_count})
                </span>
              </div>

              <div className="border-t border-white/10 my-3"></div>

              <div className="flex flex-col gap-2">
                <span className="text-gray-400">Thể loại:</span>
                <div className="flex flex-wrap gap-1.5">
                  <GenreTags genres={production.genres} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InfoHero;
