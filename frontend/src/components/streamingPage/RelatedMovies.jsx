import { useRef } from "react";
import {
  PlayCircleFilled,
  ClockCircleFilled,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import { Link } from "react-router-dom";
import { calcDurationDisplay } from "../../utils/streaming/common";

const RelatedMovies = ({ movies }) => {
  const scrollRef = useRef(null);

  // Hàm xử lý cuộn
  const scroll = (direction) => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      // Cuộn một khoảng bằng 70% chiều rộng màn hình hiện tại
      const scrollAmount = current.clientWidth * 0.7;

      current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!movies || movies.length === 0) return null;

  return (
    <div className="mt-12 mb-8 relative">
      {/* Header & Navigation Buttons */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[#ffdd95] font-bold text-xl m-0">
          Recommended for you
        </h3>

        {/* Nút điều hướng */}
        <div className="flex gap-2">
          <Button
            shape="circle"
            icon={<LeftOutlined />}
            onClick={() => scroll("left")}
            className="bg-[#2a2a2d] border-none text-white hover:!border-[#ffdd95] hover:!text-[#ffdd95] flex items-center justify-center shadow-lg"
          />
          <Button
            shape="circle"
            icon={<RightOutlined />}
            onClick={() => scroll("right")}
            className="bg-[#2a2a2d] border-none text-white hover:!border-[#ffdd95] hover:!text-[#ffdd95] flex items-center justify-center shadow-lg"
          />
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="relative group/list">
        {/* Vùng chứa danh sách phim */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth no-scrollbar snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }} // Ẩn thanh cuộn mặc định
        >
          {/* CSS inline để ẩn thanh cuộn trên Chrome/Safari */}
          <style jsx="true">{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {movies.map((movie, index) => {
            const durationDisplay = calcDurationDisplay(movie);

            return (
              <Link to={`/watch/${movie.slug}`}>
                <div
                  // Dùng index trong key vì bạn đang duplicate data để test
                  key={`${movie.id}-${index}`}
                  className="w-[160px] md:w-[180px] lg:w-[210px] shrink-0 snap-start select-none group cursor-pointer"
                >
                  {/* Poster Card */}
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-[#18181b] border border-gray-800">
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      draggable="false"
                    />

                    {/* Overlay Play Icon */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <PlayCircleFilled className="text-5xl text-white drop-shadow-xl scale-0 group-hover:scale-100 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Title & Info */}
                  <div className="px-1">
                    <h4
                      className="text-gray-200 font-bold text-sm line-clamp-1 group-hover:text-[#ffdd95] transition-colors"
                      title={movie.title}
                    >
                      {movie.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{movie.type}</span>
                      <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                      <span className="flex items-center gap-1">
                        <ClockCircleFilled className="text-[10px]" />{" "}
                        {durationDisplay}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bóng mờ 2 bên để chỉ thị còn nội dung (Optional - Hiệu ứng đẹp) */}
        <div className="absolute top-0 bottom-8 right-0 w-16 bg-gradient-to-l from-[#121212] to-transparent pointer-events-none lg:hidden"></div>
      </div>
    </div>
  );
};

export default RelatedMovies;
