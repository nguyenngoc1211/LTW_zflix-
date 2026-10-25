// Chụp đúng vùng đã khoanh từ frame video — xử lý letterboxing (object-fit: contain).
// Không gửi toàn bộ frame — chỉ ảnh trong vùng quét.
import { mapRegionToVideoPixels } from "./cropMath.js";

export const captureVideoRegion = (video, rect, containerWidth, containerHeight) => {
  if (!video || !video.videoWidth) {
    throw new Error("Video chưa sẵn sàng — đợi vài giây rồi quét lại nhé!");
  }
  const crop = mapRegionToVideoPixels({
    rect,
    containerWidth,
    containerHeight,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
  });
  if (!crop || crop.width < 2 || crop.height < 2) {
    throw new Error("Vùng chọn quá nhỏ so với độ phân giải video");
  }
  let dataUrl;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    canvas
      .getContext("2d")
      .drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    throw new Error("Trình duyệt chặn việc lấy hình ảnh từ video này (CORS) — không thể quét");
  }
  // dataURL -> Blob (multipart/form-data)
  const base64 = dataUrl.split(",")[1];
  const blob = new Blob([Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))], { type: "image/jpeg" });
  return { blob, dataUrl, crop, cropMs: 0 };
};
