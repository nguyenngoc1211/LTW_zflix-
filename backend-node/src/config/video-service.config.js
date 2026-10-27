import "dotenv/config";

// URL của Python video-processor. Mặc định trỏ localhost cho dev trên Windows;
// trong docker-compose đặt VIDEO_SERVICE_URL=http://video_service:8001.
const DEFAULT_PORT = 8001;

const normalize = (value) => (value || "").trim().replace(/\/+$/, "");

export const videoServiceUrl = normalize(process.env.VIDEO_SERVICE_URL)
  || `http://127.0.0.1:${DEFAULT_PORT}`;

export const videoServiceProcessEndpoint = `${videoServiceUrl}/process-video`;
