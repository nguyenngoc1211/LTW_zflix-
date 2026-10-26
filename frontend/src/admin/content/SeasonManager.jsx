/* eslint-disable no-unused-vars */
import { useState } from "react";
import { Collapse, Button, Empty, message, Popconfirm } from "antd";
import {
  PlayCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

import ModalSaveSeason from "./ModalSaveSeason";
import ModalSaveEpisode from "./ModalSaveEpisode";
import EpisodeList from "../../components/adminContent/EpisodeList";
import { deleteEpisode } from "../../services/movieService";

const { Panel } = Collapse;

const SeasonManager = ({ production, refreshData }) => {
  const [isSeasonModalOpen, setSeasonModalOpen] = useState(false);
  const [isEpisodeModalOpen, setEpisodeModalOpen] = useState(false);
  const [currentEditingEpisode, setCurrentEditingEpisode] = useState(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0); // Dùng để ép reload danh sách tập
  const [targetSeasonId, setTargetSeasonId] = useState(null); // Lưu ID của mùa đang thao tác

  const handleEditEpisode = (episode, seasonId) => {
    setCurrentEditingEpisode(episode);
    setTargetSeasonId(seasonId);
    setEpisodeModalOpen(true);
  };

  const handleAddEpisode = (e, seasonId) => {
    e?.stopPropagation();
    setCurrentEditingEpisode(null);
    setTargetSeasonId(seasonId);
    setEpisodeModalOpen(true);
  };

  const handleCloseModal = (shouldRefresh) => {
    setSeasonModalOpen(false);
    setEpisodeModalOpen(false);
    if (shouldRefresh) {
      setRefreshTrigger((prev) => prev + 1);
      if (refreshData) refreshData(); // Ép cấp cha tải lại data nếu có
    }
  };

  const handleDeleteMovieFile = async (episodeId) => {
    try {
      await deleteEpisode(episodeId);
      message.success("Đã xóa file phim!");
      if (refreshData) refreshData(); // Tải lại Drawer
    } catch (error) {
      message.error("Lỗi khi xóa file phim!");
    }
  };

  // Logic hiển thị cho MOVIE
  if (production.type === "movie") {
    // Lấy tập phim duy nhất từ mảng episodes do API trả về
    const movieEpisode = production.episodes?.[0];

    return (
      <div>
        <div className="font-bold text-lg mb-4">Quản lý File Phim Lẻ</div>
        {!movieEpisode ? (
          <Empty
            description="Phim này chưa có file video"
            children={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                // Với movie, targetSeasonId chính là production.id
                onClick={(e) => handleAddEpisode(e, production.id)}
              >
                Thêm File
              </Button>
            }
          />
        ) : (
          <div className="border p-4 rounded shadow-sm flex justify-between items-center">
            <div className="flex gap-4">
              <div className="w-24 h-16 bg-black rounded flex items-center justify-center text-white relative overflow-hidden">
                {movieEpisode.thumbnail_url && (
                  <img
                    src={movieEpisode.thumbnail_url}
                    alt="Thumbnail"
                    className="w-full h-full object-cover absolute top-0 left-0 opacity-60"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <PlayCircleOutlined className="text-2xl z-10" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="font-bold">
                  {movieEpisode.title || "Full Movie"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {movieEpisode.duration >= 60
                    ? `${Math.floor(movieEpisode.duration / 60)} phút`
                    : `${movieEpisode.duration} giây`}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                icon={<EditOutlined />}
                onClick={() => handleEditEpisode(movieEpisode, production.id)}
              >
                Sửa File
              </Button>
              <Popconfirm
                title="Xóa file này?"
                onConfirm={() => handleDeleteMovieFile(movieEpisode.id)}
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          </div>
        )}
        <ModalSaveEpisode
          open={isEpisodeModalOpen}
          onCancel={handleCloseModal}
          initialData={currentEditingEpisode}
          targetSeasonId={targetSeasonId}
        />
      </div>
    );
  }

  // Logic hiển thị cho SERIES
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="font-bold text-lg m-0">Danh sách Mùa</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setSeasonModalOpen(true)}
        >
          Thêm Mùa
        </Button>
      </div>
      {!production.seasons?.length ? (
        <Empty description="Chưa có mùa nào" />
      ) : (
        <Collapse accordion defaultActiveKey={["1"]}>
          {production.seasons.map((season) => (
            <Panel
              header={
                <span className="font-semibold">
                  {season.title || `Mùa ${season.season_number}`}
                </span>
              }
              key={season.id}
              extra={
                <Button
                  type="primary"
                  size="small"
                  ghost
                  icon={<PlusOutlined />}
                  onClick={(e) => handleAddEpisode(e, season.id)}
                >
                  Thêm tập
                </Button>
              }
            >
              <EpisodeList
                seasonId={season.id}
                onEditEpisode={(item) => handleEditEpisode(item, season.id)}
                refreshTrigger={refreshTrigger}
              />
            </Panel>
          ))}
        </Collapse>
      )}
      <ModalSaveSeason
        open={isSeasonModalOpen}
        onCancel={handleCloseModal}
        seriesId={production.id}
      />
      <ModalSaveEpisode
        open={isEpisodeModalOpen}
        onCancel={handleCloseModal}
        initialData={currentEditingEpisode}
        targetSeasonId={targetSeasonId} // Truyền ID của mùa (production_id)
      />
    </div>
  );
};

export default SeasonManager;
