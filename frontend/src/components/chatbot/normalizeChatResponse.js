const safePosterUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const normalizeMovieCards = (response) => {
  const candidates = Array.isArray(response?.movies)
    ? response.movies
    : Array.isArray(response?.sources)
      ? response.sources.filter((item) => item && typeof item.title === "string")
      : [];
  const ids = new Set();
  return candidates.flatMap((item) => {
    const id = Number(item?.id ?? item?.production_id);
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (!Number.isSafeInteger(id) || id <= 0 || !title || ids.has(id)) return [];
    ids.add(id);
    const genres = Array.isArray(item.genres)
      ? item.genres.filter((genre) => typeof genre === "string" && genre.trim())
      : [];
    const rawRating = item.rating_avg ?? item.rating;
    const rating = rawRating == null || rawRating === "" ? NaN : Number(rawRating);
    const rawYear = item.release_year ?? item.year;
    const year = typeof rawYear === "string" || typeof rawYear === "number" ? rawYear : null;
    return [{
      id,
      title,
      poster: safePosterUrl(item.poster ?? item.poster_url),
      year,
      genres,
      rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
      description: typeof item.description === "string" ? item.description.trim() : "",
    }];
  }).slice(0, 4);
};

export const normalizeChatResponse = (response) => {
  const movies = normalizeMovieCards(response);
  const sources = movies.length === 0 && Array.isArray(response?.sources)
    ? [...new Set(response.sources.map((item) => Number(item?.production_id)).filter((id) =>
      Number.isSafeInteger(id) && id > 0))].slice(0, 3)
    : [];
  return {
    text: typeof response?.answer === "string" && response.answer.trim()
      ? response.answer
      : "Mình chưa có câu trả lời phù hợp lúc này.",
    movies,
    sources,
  };
};
