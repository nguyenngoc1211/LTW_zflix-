import { Modal, Form, InputNumber, message, Row, Col } from "antd";
import { createSeason } from "../../services/movieService";
import { useState } from "react";

const ModalSaveSeason = ({ open, onCancel, seriesId }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await createSeason(seriesId, values);
      messageApi.success("Tạo mùa mới thành công!");
      form.resetFields();
      onCancel(true);
    } catch (error) {
      messageApi.error("Lỗi khi tạo mùa!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="Thêm Mùa Mới"
        open={open}
        onCancel={() => onCancel(false)}
        onOk={form.submit}
        okText="Tạo"
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={15}>
            <Col span={24}>
              <Form.Item
                name="season_number"
                label="Thứ tự mùa"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} className="!w-full" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default ModalSaveSeason;
