import { Tag } from "antd";
import { VideoCameraOutlined, FolderOpenOutlined } from "@ant-design/icons";

// 1. Tag Loại phim (Movie/Series)
export const TypeTag = ({ type }) => {
  if (type === "movie") {
    return (
      <Tag icon={<VideoCameraOutlined />} color="cyan">
        <b>Phim Lẻ</b>
      </Tag>
    );
  }
  return (
    <Tag icon={<FolderOpenOutlined />} color="purple">
      <b>Phim Bộ</b>
    </Tag>
  );
};

// 2. Tag VIP/Free
export const PremiumTag = ({ isPremium }) => {
  return (
    <Tag color={isPremium ? "gold" : "green"}>
      {isPremium ? <b>VIP</b> : <b>Free</b>}
    </Tag>
  );
};

// 3. Tag Trạng thái (Hoàn thành/Đang chiếu)
export const StatusTag = ({ status }) => {
  const isCompleted = status === "completed";
  return (
    <Tag color={isCompleted ? "blue" : "orange"}>
      {isCompleted ? <b>Đã hoàn thành</b> : <b>Đang tiến hành</b>}
    </Tag>
  );
};

// 4. Danh sách Tag Thể loại
export const GenreTags = ({ genres }) => {
  if (!genres || genres.length === 0) return null;
  return (
    <>
      {genres.map((g) => (
        <Tag key={g.id} color="geekblue" className="text-[10px] mr-1 mb-1">
          <b>{g.name}</b>
        </Tag>
      ))}
    </>
  );
};
