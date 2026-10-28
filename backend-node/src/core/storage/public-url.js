// DB lưu key R2 (vd "raw/movies/abc.mp4") khi video vừa upload và HLS chưa
// xử lý xong. Chuyển key thành URL public để client phát được ngay.
export const toPublicMediaUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  const domain = (process.env.R2_PUBLIC_DOMAIN || "").replace(/\/+$/, "");
  if (!domain) return null;

  return `${domain}/${String(value).replace(/^\/+/, "")}`;
};
