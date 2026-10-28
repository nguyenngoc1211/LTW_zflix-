import { useEffect } from "react";
import Hls from "hls.js";
import { API_URL } from "../services/api.js";

// Video trên R2 KHÔNG có CORS (đã kiểm tra: không trả Access-Control-Allow-Origin),
// nên trình duyệt không tải trực tiếp được. Phải phát qua proxy của backend.
export const toPlayableUrl = (url) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".r2.dev")) {
      return `${API_URL}/api/v1/hls${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // URL không hợp lệ — giữ nguyên
  }
  return url;
};

// Gắn nguồn video vào thẻ <video>: dùng hls.js cho .m3u8 khi trình duyệt không
// hỗ trợ native (Chrome, Firefox), native cho Safari và mọi file .mp4.
//
// Trả về cleanup để component gọi khi đổi tập / unmount.
export const useVideoSource = ({ videoRef, videoUrl }) => {
  useEffect(() => {
    const video = videoRef.current;
    const url = toPlayableUrl(videoUrl);
    if (!video || !url) return undefined;

    const isHls = /\.m3u8($|\?)/i.test(url);
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");

    if (!isHls || nativeHls || !Hls.isSupported()) {
      video.src = url;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      else hls.destroy();
    });
    return () => hls.destroy();
  }, [videoRef, videoUrl]);
};
