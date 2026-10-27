const SeasonSelector = ({
  currentSeasonId,
  seasons,
  productionType,
  onSeasonClick,
}) => {
  if (productionType === "movie" || !seasons || seasons.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 mb-6">
      <h3 className="text-[#ffdd95] font-bold text-lg mb-3">
        Xem thêm các mùa khác của phim này
      </h3>

      <div className="flex flex-wrap gap-3">
        {seasons.map((season) => {
          const isActive = season.id === currentSeasonId;
          return (
            <div
              key={season.id}
              className={`
                relative h-16 min-w-[150px] px-4 rounded-xl border cursor-pointer overflow-hidden group transition-all
                flex items-center justify-center
                ${
                  isActive
                    ? "border-[#ffdd95] bg-[#ffdd95]/10"
                    : "border-gray-700 bg-[#18181b] hover:border-gray-500"
                }
              `}
              onClick={() => onSeasonClick(season.id)}
            >
              {/* Giả lập ảnh nền season làm background mờ (nếu có) */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-20 group-hover:opacity-40 transition-opacity"
                style={{
                  backgroundImage: `url('https://image.tmdb.org/t/p/w200/49WJfeN0moxb9IPfGn8AIqMGskD.jpg')`,
                }} // Dùng tạm ảnh poster
              />

              <span
                className={`relative z-10 font-bold ${isActive ? "text-[#ffdd95]" : "text-gray-300 group-hover:text-white"}`}
              >
                {season.title || `Mùa ${season.season_number}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SeasonSelector;
