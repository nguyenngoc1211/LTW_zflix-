import { updateVideoWebhookService } from "../services/episode.service.js";

export const webhookVideoController = async (req, res) => {
  try {
    const { production_id, episode_id, m3u8_url } = req.body;

    if (!episode_id || !m3u8_url) {
      console.error("Dữ liệu từ Python gửi về bị thiếu!");
      return res.status(400).json({ error: "Thiếu thông tin Webhook" });
    }

    // Tiến hành gọi service cập nhật DB
    await updateVideoWebhookService(production_id, episode_id, m3u8_url);

    res.json({ message: "Đã cập nhật video URL thành công!" });
  } catch (error) {
    console.error("❌ [WEBHOOK CRASH LỖI DATABASE]:", error);
    res.status(500).json({ error: error.message });
  }
};
