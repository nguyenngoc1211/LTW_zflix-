import { message } from "antd";

const useWatchlist = () => ({
  isInWatchlist: false,
  loading: false,
  toggleWatchlist: () => message.info("Danh sách yêu thích đã được tắt."),
});

export default useWatchlist;
