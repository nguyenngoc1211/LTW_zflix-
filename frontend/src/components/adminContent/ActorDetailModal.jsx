import { Descriptions, Image, Modal, Tag } from "antd";
import AnonymousAvatar from "../../assets/anonymous.png";
import {
  CalendarOutlined,
  GlobalOutlined,
  ManOutlined,
  WomanOutlined,
} from "@ant-design/icons";
const ActorDetailModal = (props) => {
  const { selectedActor, setSelectedActor } = props;
  console.log(selectedActor);

  const renderGender = (gender) => {
    if (gender === "Female" || gender === "female")
      return (
        <Tag icon={<WomanOutlined />} color="magenta">
          Nữ
        </Tag>
      );
    if (gender === "Male" || gender === "male")
      return (
        <Tag icon={<ManOutlined />} color="blue">
          Nam
        </Tag>
      );
    return <Tag>N/A</Tag>;
  };

  return (
    <Modal
      title={null}
      open={!!selectedActor}
      onCancel={() => setSelectedActor(null)}
      footer={null}
      width={700}
      destroyOnClose
      centered
    >
      {selectedActor && (
        <div className="flex flex-col md:flex-row gap-6 p-2">
          {/* Cột Trái: Ảnh lớn */}
          <div className="w-full md:w-1/3 flex flex-col items-center">
            <div className="rounded-lg overflow-hidden shadow-lg border border-gray-200 mb-3 w-full">
              <Image
                src={
                  selectedActor?.avatar_url
                    ? selectedActor.avatar_url
                    : AnonymousAvatar
                }
                alt={selectedActor.name}
                width="100%"
                className="object-cover aspect-[2/3]"
              />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold mb-1">{selectedActor.name}</h2>
              <Tag color="cyan">{selectedActor.character_name || "Cast"}</Tag>
            </div>
          </div>

          {/* Cột Phải: Thông tin chi tiết */}
          <div className="w-full md:w-2/3">
            <Descriptions
              title="Thông tin cá nhân"
              column={1}
              size="small"
              bordered
            >
              <Descriptions.Item label="Giới tính">
                {renderGender(selectedActor.gender)}
              </Descriptions.Item>
              {selectedActor.birth_date && (
                <Descriptions.Item label="Sinh nhật">
                  <span className="flex items-center gap-2">
                    <CalendarOutlined />{" "}
                    {selectedActor.birth_date.substring(0, 10)}
                  </span>
                </Descriptions.Item>
              )}
              {selectedActor.country && (
                <Descriptions.Item label="Nơi sinh">
                  <span className="flex items-center gap-2">
                    <GlobalOutlined /> {selectedActor.country}
                  </span>
                </Descriptions.Item>
              )}
            </Descriptions>

            <div className="mt-4">
              <h4 className="font-bold  mb-2 border-b pb-1">Tiểu sử</h4>
              <div className=" p-3 rounded-lg border border-gray-100 max-h-[250px] overflow-y-auto custom-scrollbar">
                {selectedActor.bio ? (
                  <span className="text-white text-justify mb-0 whitespace-pre-wrap">
                    {selectedActor.bio}
                  </span>
                ) : (
                  <span className="text-gray-400 italic">
                    Chưa có thông tin tiểu sử.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ActorDetailModal;
