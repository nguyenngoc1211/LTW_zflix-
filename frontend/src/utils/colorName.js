// Lấy màu chủ đạo từ pixel data (ImageData.data) và trả về tên màu tiếng Việt
// dùng làm filter `color` trong catalog. Không cần AI — thuần toán học.
const NAMED_COLORS = [
  { name: "đỏ", r: 200, g: 40, b: 40 },
  { name: "cam", r: 240, g: 140, b: 40 },
  { name: "vàng", r: 230, g: 210, b: 60 },
  { name: "xanh lá", r: 60, g: 160, b: 70 },
  { name: "xanh dương", r: 50, g: 90, b: 200 },
  { name: "tím", r: 130, g: 60, b: 180 },
  { name: "hồng", r: 230, g: 120, b: 160 },
  { name: "nâu", r: 120, g: 80, b: 50 },
  { name: "trắng", r: 245, g: 245, b: 245 },
  { name: "đen", r: 25, g: 25, b: 25 },
  { name: "xám", r: 130, g: 130, b: 130 },
  { name: "be", r: 215, g: 195, b: 165 },
];

export const dominantColorName = (imageData, { skipLightAbove = 235, skipDarkBelow = 20 } = {}) => {
  if (!imageData?.length) return null;
  // Bỏ pixel quá sáng/tối (chữ, viền, bóng) — tính màu trung bình các pixel còn lại
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < imageData.length; i += 16) { // bước 4 pixel cho nhanh
    const pr = imageData[i], pg = imageData[i + 1], pb = imageData[i + 2];
    const brightness = (pr + pg + pb) / 3;
    if (brightness > skipLightAbove || brightness < skipDarkBelow) continue;
    r += pr; g += pg; b += pb; count += 1;
  }
  if (count < 50) return null;
  r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
  // Tìm màu đặt tên gần nhất (khoảng cách Euclid RGB)
  let best = null, bestDist = Infinity;
  for (const named of NAMED_COLORS) {
    const dist = (r - named.r) ** 2 + (g - named.g) ** 2 + (b - named.b) ** 2;
    if (dist < bestDist) { bestDist = dist; best = named.name; }
  }
  return best;
};
