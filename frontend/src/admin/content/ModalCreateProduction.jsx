import { Modal, Form, Button, message, Tabs } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import GeneralInfoTab from "./GeneralInfoTab";
import ActorsTab from "./ActorsTab";
import { updateProduction, uploadMovie } from "../../services/movieService";

const ModalCreateProduction = ({
  open,
  setOpen,
  refreshTable,
  initialData,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("movie");
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.setFieldsValue({
          ...initialData,
          genres: initialData.genres?.map((g) => g.id) || [],
          type: initialData.type,
          status: initialData.status || "ongoing",

          poster_url: initialData.poster_url,
          banner_url: initialData.banner_url,
          country: initialData.country,
          duration:
            initialData.movies?.duration !== undefined &&
            initialData.movies?.duration !== null
              ? initialData.movies.duration
              : initialData.episodes?.[0]?.duration
                ? Math.floor(initialData.episodes[0].duration / 60)
                : "",

          actors:
            initialData.actors?.map((a) => ({
              name: a.name,
              character: a.character_name,
              avatar_url: a.avatar_url || "",
            })) || [],
        });
        setType(initialData.type);
      } else {
        form.resetFields();
        setType("movie");
      }
    }
  }, [open, initialData, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", values.title);
      formData.append("type", type);
      formData.append("status", values.status);
      formData.append("genres", JSON.stringify(values.genres || []));
      formData.append(
        "poster_url",
        values.poster_url || "https://via.placeholder.com/150",
      );
      formData.append(
        "banner_url",
        values.banner_url || "https://via.placeholder.com/150",
      );
      formData.append("is_premium", values.is_premium || false);

      if (values.release_year)
        formData.append("release_year", values.release_year);
      if (values.description)
        formData.append("description", values.description);
      if (values.country) formData.append("country", values.country);
      if (values.language) formData.append("language", values.language);
      if (values.duration !== undefined && values.duration !== null)
        formData.append("duration", values.duration);
      if (values.actors && values.actors.length > 0) {
        formData.append("actors", JSON.stringify(values.actors));
      }

      if (values.video && values.video.length > 0) {
        // Vì values.video đã là một mảng, ta truy cập thẳng vào phần tử [0]
        const videoFile = values.video[0].originFileObj;
        formData.append("video", videoFile);
        console.log("Đã attach file thành công:", videoFile.name);
      }

      // Xử lý tạo mới hoặc cập nhật
      if (initialData) {
        await updateProduction(initialData.id, formData);
        messageApi.success("Cập nhật thành công!");
      } else {
        await uploadMovie(formData);
        messageApi.success("Thêm mới thành công!");
      }

      form.resetFields();
      setOpen(false);
      refreshTable();
    } catch (error) {
      console.error("API Error:", error);

      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Có lỗi xảy ra, vui lòng thử lại!";

      messageApi.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title={initialData ? `Sửa: ${initialData.title}` : "Thêm Nội Dung Mới"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            type: "movie",
            release_year: new Date().getFullYear(),
            is_premium: false,
            status: "ongoing",
          }}
        >
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: "1",
                label: "Thông tin chung",
                children: (
                  <GeneralInfoTab
                    type={type}
                    setType={setType}
                    initialData={initialData}
                    status={status}
                    form={form}
                  />
                ),
              },
              { key: "2", label: "Diễn viên (Cast)", children: <ActorsTab /> },
            ]}
          />

          <div className="flex justify-end gap-2 ">
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<UploadOutlined />}
            >
              {initialData ? "Lưu Thay Đổi" : "Tạo Mới"}
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};

export default ModalCreateProduction;
