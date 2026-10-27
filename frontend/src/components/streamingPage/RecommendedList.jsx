import { PlayCircleOutlined, StarFilled } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { calcDurationDisplay } from "../../utils/streaming/common";

const RecommendedList = ({ list }) => {
  return (
    <div className="bg-[#18181b] rounded-xl overflow-hidden border border-gray-800">
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-[#ffdd95] font-bold m-0 uppercase text-sm">
          Most Popular
        </h3>
      </div>

      <div className="flex flex-col">
        {list.map((item, index) => {
          const durationDisplay = calcDurationDisplay(item);

          return (
            <Link to={`/watch/${item.slug}`}>
              <div
                key={item.id}
                className="flex gap-3 p-3 hover:bg-[#202024] transition-colors cursor-pointer border-b border-gray-800/50 last:border-none group"
              >
                <div className="relative w-12 h-16 flex-shrink-0">
                  <img
                    src={item.poster}
                    className="w-full h-full object-cover rounded"
                    alt=""
                  />
                  <div className="absolute top-0 left-0 bg-[#ffdd95] text-[#111] text-[10px] px-1 font-bold rounded-br">
                    #{index + 1}
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <h4 className="text-gray-200 text-sm font-medium line-clamp-1 group-hover:text-[#ffdd95] transition-colors">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <PlayCircleOutlined /> {item.type}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <StarFilled className="text-yellow-600" />{" "}
                      {durationDisplay}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendedList;
