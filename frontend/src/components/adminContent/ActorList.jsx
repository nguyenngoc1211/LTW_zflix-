import { useRef, useState } from "react";
import { Avatar, Button } from "antd";
import { UserOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import AnonymousAvatar from "../../assets/anonymous.png";
import ActorDetailModal from "./ActorDetailModal";

const ActorList = ({ actors }) => {
  const scrollRef = useRef(null);
  const [selectedActor, setSelectedActor] = useState(null);
  console.log(actors);

  // Hàm xử lý cuộn
  const scroll = (direction) => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = 200; // Khoảng cách cuộn mỗi lần click (px)
      if (direction === "left") {
        current.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      } else {
        current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }
  };

  if (!actors || actors.length === 0) {
    return (
      <div className="text-center text-gray-400 py-4 italic rounded border border-dashed">
        Chưa cập nhật danh sách diễn viên.
      </div>
    );
  }

  return (
    <>
      <div className="relative group w-full px-2 flex flex-col">
        <div className="self-end">
          {/* Nút lùi (Left Arrow) - Chỉ hiện khi hover vào vùng danh sách */}
          <Button
            shape="circle"
            icon={<LeftOutlined />}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden group-hover:flex items-center justify-center shadow-md border-none bg-white/80 hover:!border-[#ffdd95] hover:!text-[#ffdd95] mr-[10px]"
            onClick={() => scroll("left")}
          />

          {/* Nút tiến (Right Arrow) */}
          <Button
            shape="circle"
            icon={<RightOutlined />}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden group-hover:flex items-center justify-center shadow-md border-none bg-white/80 hover:!border-[#ffdd95] hover:!text-[#ffdd95]"
            onClick={() => scroll("right")}
          />
        </div>
        {/* Container chứa danh sách (Scrollable Area) */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-8 py-2 px-1 scroll-smooth no-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }} // Ẩn thanh cuộn mặc định
        >
          {actors.map((actor, index) => (
            <div
              key={index}
              className="flex flex-col items-center min-w-[100px] max-w-[120px] cursor-pointer group/item"
              onClick={() => setSelectedActor(actor)}
            >
              <Avatar
                size={64}
                src={actor?.avatar_url ? actor.avatar_url : AnonymousAvatar}
                icon={<UserOutlined />}
                className="mb-2 shadow-sm group-hover/item:shadow-md transition-all border border-gray-200"
              />
              <div className="font-semibold text-sm truncate w-full text-center px-1">
                {actor.name}
              </div>
              <div className="text-xs text-gray-500 truncate w-full text-center px-1">
                {actor.character_name || "Diễn viên"}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ActorDetailModal
        selectedActor={selectedActor}
        setSelectedActor={setSelectedActor}
      />
    </>
  );
};

export default ActorList;
