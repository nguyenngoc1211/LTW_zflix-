export const DUMMY_MOVIE_URL =
  "https://pub-f864fbe037974c43a6405afe9a0601de.r2.dev/hls/1792479683719-545/playlist.m3u8";

export const DUMMY_SERIES_URLS = [
  "https://pub-f864fbe037974c43a6405afe9a0601de.r2.dev/hls/1792480481546-125/playlist.m3u8", // Series - S1 E1
  "https://pub-f864fbe037974c43a6405afe9a0601de.r2.dev/hls/1792479683719-545/playlist.m3u8", // Series - S2 E1
];

export const getFallbackVideoUrl = (
  originalUrl,
  type,
  seasonNumber = 1,
  episodeNumber = 1,
) => {
  // Nếu có link hợp lệ (bắt đầu bằng http) thì trả về luôn link đó
  if (originalUrl && originalUrl.startsWith("http")) {
    return originalUrl;
  }

  if (type === "movie") {
    return DUMMY_MOVIE_URL;
  }

  const sum = Number(seasonNumber) + Number(episodeNumber);
  const index = sum % 2; // Sinh ra 0 hoặc 1

  return DUMMY_SERIES_URLS[index];
};
