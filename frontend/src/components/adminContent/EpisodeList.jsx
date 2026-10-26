/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { List, Button, Empty, Spin, Popconfirm, message } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  getEpisodesBySeason,
  deleteEpisode,
} from "../../services/movieService";

const EpisodeList = ({ seasonId, onEditEpisode, refreshTrigger }) => {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEpisodesBySeason(seasonId);
      setEpisodes(res.data);
    } catch (error) {
      console.error("Lỗi lấy danh sách tập:", error);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  // Load lại danh sách khi seasonId thay đổi hoặc có tín hiệu refresh
  useEffect(() => {
    fetchEpisodes();
  }, [fetchEpisodes, refreshTrigger]);

  if (loading)
    return (
      <div className="text-center p-2">
        <Spin />
      </div>
    );

  const handleDelete = async (id) => {
    try {
      await deleteEpisode(id);
      message.success("Đã xóa tập phim!");
      fetchEpisodes(); // Load lại list sau khi xóa
    } catch (error) {
      message.error("Lỗi khi xóa tập!");
    }
  };

  if (episodes.length === 0)
    return <Empty description="Trống" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return (
    <List
      size="small"
      dataSource={episodes}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button
              key="edit"
              type="text"
              icon={<EditOutlined />}
              size="small"
              className="text-blue-600"
              onClick={() => onEditEpisode(item)}
            >
              Sửa
            </Button>,
            <Popconfirm
              key="del"
              title="Xóa tập này?"
              onConfirm={() => handleDelete(item.id)}
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small">
                Xóa
              </Button>
            </Popconfirm>,
          ]}
        >
          <List.Item.Meta
            avatar={
              <div className="w-16 h-10 bg-black rounded flex items-center justify-center text-white relative overflow-hidden mt-1">
                {item.thumbnail_url && (
                  <img
                    src={item.thumbnail_url}
                    alt="Thumbnail"
                    className="w-full h-full object-cover absolute top-0 left-0 opacity-60"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <PlayCircleOutlined className="text-xl z-10" />
              </div>
            }
            title={
              <span className="font-medium">
                Tập {item.episode_number}: {item.title}
              </span>
            }
            description={
              item.duration >= 60
                ? `${Math.floor(item.duration / 60)} phút`
                : `${item.duration} giây`
            }
          />
        </List.Item>
      )}
    />
  );
};

export default EpisodeList;
