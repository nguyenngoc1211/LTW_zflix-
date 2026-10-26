import { message } from "antd";

const useShareUrl = () => {
  const [messageApi, contextHolder] = message.useMessage();

  const handleCopyUrl = async () => {
    const currentUrl = window.location.href;
    navigator.clipboard
      .writeText(currentUrl)
      .then(() => {
        messageApi.success("Đã copy đường dẫn phim vào bộ nhớ tạm!");
      })
      .catch(() => {
        messageApi.error("Lỗi khi copy đường dẫn!");
      });
  };

  return {
    handleCopyUrl,
    contextHolder,
  };
};

export default useShareUrl;
