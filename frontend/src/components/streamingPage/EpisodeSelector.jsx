import { Input } from "antd";
import {
  PlayCircleOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";

const EpisodeSelector = ({ episodes, currentEpisodeId, onEpisodeClick }) => {
  return (
    <div className="bg-[#18181b] h-full flex flex-col border-r border-gray-800">
      {/* Header Sidebar */}
      <div className="p-3 bg-[#202022] border-b border-gray-800">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-200 text-sm font-semibold flex items-center gap-2">
            <UnorderedListOutlined /> Danh sách tập phim
          </span>
        </div>
        <Input
          prefix={<SearchOutlined className="text-gray-500" />}
          placeholder="Number..."
          className="bg-[#121212] border-gray-700 text-white placeholder-gray-600 text-xs h-8 rounded"
        />
      </div>

      {/* List Episodes */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-[#121212]">
        <div className="flex flex-col">
          {episodes.map((ep) => {
            const isActive = ep.id === currentEpisodeId;
            return (
              <div
                key={ep.id}
                onClick={() => onEpisodeClick(ep)}
                className={`
                    group flex items-center gap-3 p-3 cursor-pointer border-b border-gray-800/50 transition-all
                    ${
                      isActive
                        ? "bg-[#ffdd95]/20 border-l-4 border-l-[#ffdd95]"
                        : "hover:bg-[#1f1f22] border-l-4 border-l-transparent"
                    }
                `}
              >
                {/* Số thứ tự tập */}
                <div
                  className={`flex-shrink-0 w-8 text-center font-bold text-lg ${isActive ? "text-[#ffdd95]" : "text-gray-500 group-hover:text-white"}`}
                >
                  {ep.episode_number}
                </div>

                {/* Thông tin tập */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-gray-300 group-hover:text-white"}`}
                  >
                    {ep.title}
                  </div>
                  {/* Thời lượng (nếu có) */}
                  <div className="text-[10px] text-white mt-0.5 group-hover:text-gray-400">
                    {ep.duration >= 60
                      ? `${Math.floor(ep.duration / 60)} phút`
                      : `${ep.duration} giây`}
                  </div>
                </div>

                {/* Icon Play (Chỉ hiện khi Active hoặc Hover) */}
                <div
                  className={`text-xl ${isActive ? "text-[#ffdd95] opacity-100" : "text-gray-500 opacity-0 group-hover:opacity-100"}`}
                >
                  <PlayCircleOutlined />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EpisodeSelector;
