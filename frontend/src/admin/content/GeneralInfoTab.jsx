import {
  FolderAddOutlined,
  UploadOutlined,
  VideoCameraAddOutlined,
} from "@ant-design/icons";
import {
  Button,
  Col,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Switch,
  Upload,
} from "antd";
import TextArea from "antd/es/input/TextArea";
import { getGenres } from "../../services/movieService";
import { useEffect, useState } from "react";

const GeneralInfoTab = (props) => {
  const { initialData, type, setType, form } = props;
  const [allGenres, setAllGenres] = useState([]);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const genres = await getGenres();
        setAllGenres(genres);
      } catch (error) {
        console.error("Lỗi khi lấy thể loại:", error);
      }
    };
    fetchGenres();
  }, []);

  return (
    <>
      <Form.Item name="type" className="mb-2 text-center">
        <Radio.Group
          buttonStyle="solid"
          size="large"
          onChange={(e) => setType(e.target.value)}
          value={type}
          disabled={!!initialData}
        >
          <Radio.Button value="movie">
            <VideoCameraAddOutlined className="mr-2" />
            Phim Lẻ
          </Radio.Button>
          <Radio.Button value="series">
            <FolderAddOutlined className="mr-2" />
            Phim Bộ
          </Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Row gutter={10}>
        <Col span={24}>
          <Form.Item
            name="title"
            label="Tên Phim / Series"
            rules={[{ required: true, message: "Nhập tên phim" }]}
          >
            <Input placeholder="Ví dụ: Đào, Phở và Piano..." />
          </Form.Item>
        </Col>

        <Col span={24}>
          <Form.Item
            name="genres"
            label="Thể loại"
            rules={[{ required: true, message: "Chọn thể loại" }]}
          >
            <Select mode="multiple" placeholder="Chọn thể loại..." allowClear>
              {allGenres.map((g) => (
                <Option key={g.id} value={g.id}>
                  {g.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="release_year" label="Năm SX">
            <Input type="number" />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="country" label="Quốc gia">
            <Input placeholder="VD: Mỹ, Hàn Quốc, Việt Nam..." />
          </Form.Item>
        </Col>

        <Col span={16}>
          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: "Chọn trạng thái" }]}
          >
            <Select placeholder="Chọn...">
              <Option value="ongoing">Đang tiến hành</Option>
              <Option value="completed">Đã hoàn thành</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item
            name="is_premium"
            label="Chế độ VIP"
            valuePropName="checked"
          >
            <Switch checkedChildren="VIP" unCheckedChildren="Free" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="poster_url" label="Link Poster">
            <Input prefix={<UploadOutlined />} placeholder="https://..." />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="banner_url" label="Link Banner">
            <Input prefix={<UploadOutlined />} placeholder="https://..." />
          </Form.Item>
        </Col>

        {type === "movie" && (
          <Col span={8}>
            <Form.Item name="duration" label="Thời lượng (Phút)" hidden>
              <Input type="number" placeholder="Sẽ tự động tính..." />
            </Form.Item>
          </Col>
        )}

        <Col span={24}>
          <Form.Item name="description" label="Mô tả / Cốt truyện">
            <TextArea rows={3} placeholder="Nội dung chính..." />
          </Form.Item>
        </Col>
      </Row>

      {!initialData && type === "movie" && (
        <div>
          <Form.Item
            name="video"
            label="Upload Video (MP4)"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) return e;
              return e?.fileList;
            }}
          >
            <Upload
              maxCount={1}
              accept="video/mp4"
              beforeUpload={(file) => {
                const videoUrl = URL.createObjectURL(file);
                const video = document.createElement("video");
                video.preload = "metadata";

                const handleDuration = (duration) => {
                  window.URL.revokeObjectURL(videoUrl);

                  // Chỉ cần lưu duy nhất số giây vào DB để thống nhất dữ liệu
                  const durationInSeconds = Math.round(duration);

                  form.setFieldsValue({ duration: durationInSeconds });
                  console.log(`⏱️ Đã tự tính: ${durationInSeconds} giây`);
                };

                video.onloadedmetadata = () => {
                  // Sửa lỗi Infinity đối với trình duyệt Chrome khi đọc Blob URL
                  if (video.duration === Infinity || !video.duration) {
                    video.currentTime = 10000000;
                    video.ontimeupdate = () => {
                      video.ontimeupdate = null;
                      handleDuration(video.duration);
                      video.currentTime = 0;
                    };
                  } else {
                    handleDuration(video.duration);
                  }
                };

                video.src = videoUrl;
                // Quan trọng: Trả về false để Ant Design không tự động post file đi
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>Chọn File từ máy tính</Button>
            </Upload>
          </Form.Item>
        </div>
      )}
    </>
  );
};
export default GeneralInfoTab;
