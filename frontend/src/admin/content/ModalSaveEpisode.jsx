import {
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Col,
  Upload,
  Button,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { createEpisode, updateEpisode } from "../../services/movieService";

const ModalSaveEpisode = ({ open, onCancel, initialData, targetSeasonId }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.setFieldsValue({
          ...initialData,
          thumbnail_url: initialData.thumbnail_url || "",
          // Không set file trực tiếp vào form, chỉ set link cũ vào ô nhập text
        });
        setDur(initialData.duration || 0);
      } else {
        form.resetFields();
        setDur(0);
      }
    }
  }, [open, initialData, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Dùng FormData vì có chứa file
      const formData = new FormData();
      formData.append("production_id", targetSeasonId);
      formData.append("episode_number", values.episode_number);
      formData.append("title", values.title);
      formData.append("duration", dur || values.duration || 0);

      // Thêm thumbnail_url vào formdata
      if (values.thumbnail_url) {
        formData.append("thumbnail_url", values.thumbnail_url);
      }

      // Chỉ xử lý file upload khi thêm mới
      if (!isEdit) {
        if (
          values.video &&
          values.video.length > 0
        ) {
          formData.append("video", values.video[0].originFileObj);
        } else if (values.video_url) {
          // Fallback: Nếu không upload mà nhập link ngoài (m3u8/mp4)
          formData.append("video_url", values.video_url);
        }
      }

      if (isEdit) {
        await updateEpisode(initialData.id, formData);
        messageApi.success("Cập nhật thành công!");
      } else {
        await createEpisode(formData);
        messageApi.success("Thêm tập thành công! Video đang được xử lý ngầm.");
      }
      form.resetFields();
      onCancel(true); // Đóng modal và ép reload data
    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.error || "Có lỗi xảy ra!";
      messageApi.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const normFile = (e) => {
    if (Array.isArray(e)) return e;
    return e?.fileList;
  };

  const [dur, setDur] = useState(0);

  return (
    <>
      {contextHolder}
      <Modal
        title={isEdit ? "Chỉnh sửa Video/Tập" : "Thêm tập phim mới"}
        open={open}
        onCancel={() => onCancel(false)}
        onOk={form.submit}
        okText="Lưu"
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={15}>
            <Col span={24}>
              <Form.Item
                name="episode_number"
                label="Tập số"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} className="!w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration" label="Thời lượng (giây)" hidden>
                <InputNumber min={0} className="!w-full" step={60} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="title"
                label="Tiêu đề"
                rules={[{ required: true }]}
              >
                <Input className="!w-full" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="thumbnail_url"
                label="Link Thumbnail (Ảnh thu nhỏ tập phim)"
              >
                <Input placeholder="https://..." className="!w-full" />
              </Form.Item>
            </Col>

            {!isEdit && (
              <Col span={24}>
                <Form.Item
                  name="video"
                  label="Upload Video (MP4/MKV)"
                  valuePropName="fileList"
                  getValueFromEvent={normFile}
                >
                  <Upload
                    maxCount={1}
                    accept="video/mp4,video/x-matroska"
                    beforeUpload={(file) => {
                      const videoUrl = URL.createObjectURL(file);
                      const video = document.createElement("video");
                      video.preload = "metadata";

                      const handleDuration = (duration) => {
                        window.URL.revokeObjectURL(videoUrl);

                        // Chỉ cần lưu duy nhất số giây vào DB để thống nhất dữ liệu
                        const durationInSeconds = Math.round(duration);

                        setDur(durationInSeconds);
                        form.setFieldsValue({ duration: durationInSeconds });
                        console.log(
                          `⏱️ Đã tự tính tập phim: ${durationInSeconds} giây`,
                        );
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

                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />}>
                      Chọn File từ máy tính
                    </Button>
                  </Upload>
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default ModalSaveEpisode;
