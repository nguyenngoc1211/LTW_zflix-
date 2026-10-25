// Chuyển tọa độ vùng chọn (px trong container hiển thị) sang pixel video thật.
// Xử lý object-fit: contain (letterboxing) — video không bao giờ bị crop (cover).
export const mapRegionToVideoPixels = ({ rect, containerWidth, containerHeight, videoWidth, videoHeight }) => {
  if (!containerWidth || !containerHeight || !videoWidth || !videoHeight) return null;
  const containerRatio = containerWidth / containerHeight;
  const videoRatio = videoWidth / videoHeight;
  let drawWidth = containerWidth;
  let drawHeight = containerHeight;
  let offsetX = 0;
  let offsetY = 0;
  if (videoRatio > containerRatio) {
    // video rộng hơn container -> letterbox trên/dưới
    drawHeight = containerWidth / videoRatio;
    offsetY = (containerHeight - drawHeight) / 2;
  } else {
    drawWidth = containerHeight * videoRatio;
    offsetX = (containerWidth - drawWidth) / 2;
  }
  const scaleX = videoWidth / drawWidth;
  const scaleY = videoHeight / drawHeight;
  const crop = {
    x: Math.max(0, Math.round((rect.x - offsetX) * scaleX)),
    y: Math.max(0, Math.round((rect.y - offsetY) * scaleY)),
    width: Math.round(rect.w * scaleX),
    height: Math.round(rect.h * scaleY),
  };
  crop.x = Math.min(crop.x, videoWidth - 2);
  crop.y = Math.min(crop.y, videoHeight - 2);
  crop.width = Math.min(crop.width, videoWidth - crop.x);
  crop.height = Math.min(crop.height, videoHeight - crop.y);
  return crop;
};
