import {
  LinkOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Form, Input } from "antd";

const ActorsTab = () => {
  return (
    <div className=" p-4 ">
      <div className="mb-3 text-gray-500 italic text-sm">
        Thêm diễn viên và vai diễn của họ trong phim này.
      </div>

      <Form.List name="actors">
        {(fields, { add, remove }) => (
          <>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {fields.map(({ key, name, ...restField }) => {
                console.log(key, name, fields);
                return (
                  <div
                    key={key}
                    className="flex gap-2 mb-3 items-start animate-fade-in"
                  >
                    {/* Cột 1: Chọn Diễn viên */}
                    <Form.Item
                      {...restField}
                      name={[name, "name"]}
                      rules={[
                        { required: true, message: "Nhập tên diễn viên" },
                      ]}
                      className="flex-1 mb-0"
                    >
                      <Input placeholder="Nhập tên diễn viên..." />
                    </Form.Item>

                    {/* Cột 2: Nhập tên nhân vật */}
                    <Form.Item
                      {...restField}
                      name={[name, "character"]}
                      rules={[{ required: true, message: "Nhập vai diễn" }]}
                      className="flex-1 mb-0"
                    >
                      <Input placeholder="Tên nhân vật (VD: Batman)" />
                    </Form.Item>

                    {/* Cột 3: LINK ẢNH  */}
                    <Form.Item
                      {...restField}
                      name={[name, "avatar_url"]}
                      rules={[{ type: "url", message: "Link không hợp lệ" }]}
                      className="col-span-12 md:col-span-4 mb-0"
                    >
                      <Input
                        prefix={<LinkOutlined className="text-gray-400" />}
                        placeholder="Link ảnh (https://...)"
                      />
                    </Form.Item>

                    {/* Nút Xóa dòng */}
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(name)}
                      className="mt-1"
                    />
                  </div>
                );
              })}
            </div>

            <Form.Item className="mt-4 mb-0">
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
              >
                Thêm Diễn Viên
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </div>
  );
};
export default ActorsTab;
