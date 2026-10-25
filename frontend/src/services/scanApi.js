// Gọi CineLens scan API — gửi ảnh vùng quét dạng multipart/form-data
import { apiRequest } from "./api.js";

export const scanRegion = async ({ blob, movieId, position, cropMs }) => {
  const formData = new FormData();
  formData.append("image", blob, "cinelens-scan.jpg");
  if (movieId) formData.append("movieId", String(movieId));
  formData.append("position", String(Math.floor(position || 0)));
  formData.append("cropMs", String(Math.round(cropMs || 0)));
  return apiRequest("/api/v1/scan", { method: "POST", body: formData });
};

export const getProductDetail = (productId) =>
  apiRequest(`/api/v1/scan/products/${productId}`);
