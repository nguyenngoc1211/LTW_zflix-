/* eslint-disable no-unused-vars */
import { Button, Rate } from "antd";
import {
  AppstoreAddOutlined,
  HeartFilled,
  ShareAltOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import useShareUrl from "../../hooks/streaming/useShareUrl";
import useWatchlist from "../../hooks/streaming/useWatchlist";
import { calcDurationDisplay } from "../../utils/streaming/common";

const MovieInfo = ({ production }) => {
  const { handleCopyUrl, contextHolder } = useShareUrl();
  const { toggleWatchlist, isInWatchlist, loading } = useWatchlist(
    production?.id,
  );

  const genreNames = production.genres?.map((g) => g.name).join(", ") || "";
  const durationDisplay = calcDurationDisplay(production);

  return (
    <>
      {contextHolder}
      <div className="bg-[#18181b] p-4 rounded-xl border border-gray-800 h-full overflow-y-auto custom-scrollbar">
        {/* 1. Poster & Title */}
        <div className="flex flex-col items-center text-center mb-4">
          <img
            src={production.poster_url}
            alt={production.title}
            className="w-full max-w-[200px] aspect-[2/3] object-cover rounded-lg shadow-lg border border-gray-700 mb-3"
          />
          <h1 className="text-xl font-bold text-white leading-tight mb-1">
            {production.title}
          </h1>
        </div>

        {/* 2. Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button
            type="primary"
            icon={<HeartFilled />}
            onClick={toggleWatchlist}
            loading={loading}
            className={`border-none w-full ${isInWatchlist ? "!bg-red-500 hover:!bg-red-400 !text-white" : "!bg-[#ffdd95] !text-[#111] hover:!bg-[#ffdd95]/80"}`}
          >
            {isInWatchlist ? "In List" : "Add List"}
          </Button>
          <Button
            icon={<ShareAltOutlined />}
            onClick={handleCopyUrl}
            className="bg-[#2a2a2d] border-none text-gray-300 w-full hover:!border-[#ffdd95] hover:!text-[#ffdd95]"
          >
            Share
          </Button>
        </div>

        {/* 3. Info Grid (Compact) */}
        <div className="space-y-3 text-sm text-gray-400 bg-[#121212] p-3 rounded-lg border border-gray-800/50">
          <div className="flex justify-between items-center pb-2 border-b border-gray-800">
            <span>Đánh giá:</span>
            <div className="flex items-center gap-1">
              <span className="text-white font-bold">
                {production.rating_avg}
              </span>
              <Rate
                disabled
                count={1}
                defaultValue={1}
                className="text-yellow-500 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-between">
            <span>Thời lượng:</span>
            <span className="text-gray-200">{durationDisplay}</span>
          </div>
          <div className="pt-2 border-t border-gray-800">
            <p className="mb-1">
              <span className="text-gray-500">Loại:</span>{" "}
              <span className="text-white uppercase">{production.type}</span>
            </p>
            <p className="mb-1">
              <span className="text-gray-500">Quốc gia:</span>{" "}
              {production.country}
            </p>
            <p>
              <span className="text-gray-500">Thể loại:</span> {genreNames}
            </p>
          </div>
        </div>

        <div className="pt-[10px]">
          <Link to={`/watch/${production.slug}`}>
            <Button
              icon={<AppstoreAddOutlined />}
              className="bg-[#2a2a2d] border-none text-gray-300 w-full hover:!border-[#ffdd95] hover:!text-[#ffdd95]"
            >
              Chi tiết
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
};

export default MovieInfo;
