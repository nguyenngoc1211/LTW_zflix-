import { useState } from "react";
import { Button, Typography } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";

const { Paragraph } = Typography;

const DescriptionBox = ({ description }) => {
  const [expanded, setExpanded] = useState(false);

  // Ngưỡng ký tự để hiện nút Xem thêm (nếu dài hơn 300 ký tự mới hiện nút)
  const CHAR_THRESHOLD = 300;
  const isLongText = description && description.length > CHAR_THRESHOLD;

  return (
    <div className="shadow-inner relative">
      <div
        style={{
          maxHeight: expanded ? "none" : "100px",
          overflowY: "auto",
        }}
        className="custom-scrollbar pr-2"
      >
        {description ? (
          <Paragraph className="mb-0 text-gray-300 whitespace-pre-wrap">
            {description}
          </Paragraph>
        ) : (
          <span className="text-gray-500 italic">Chưa có mô tả chi tiết.</span>
        )}
      </div>

      {/* Chỉ hiện nút Xem thêm khi văn bản dài */}
      {isLongText && (
        <div className="text-center mt-3 pt-2 border-t border-gray-700">
          <Button
            type="link"
            size="small"
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setExpanded(!expanded)}
            className="!text-[#ffdd95] hover:!text-[#ffdd95]/80"
          >
            {expanded ? "Thu gọn" : "Xem thêm"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DescriptionBox;
