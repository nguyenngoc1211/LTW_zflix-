import { apiRequest } from "./api.js";

const PRODUCTIONS_API = "/api/streaming/productions";
const EPISODES_API = "/api/streaming/episodes";

// 1. QUẢN LÝ PHIM (PRODUCTIONS)

export const uploadMovie = async (formData) =>
  apiRequest(`${PRODUCTIONS_API}/upload-video`, { method: "POST", body: formData });

export const updateProduction = async (id, formData) =>
  apiRequest(`${PRODUCTIONS_API}/update/${id}`, { method: "PUT", body: formData });

export const deleteProduction = async (id) =>
  apiRequest(`${PRODUCTIONS_API}/delete/${id}`, { method: "DELETE" });

export const getMovies = async () => apiRequest(`${PRODUCTIONS_API}/list`);

export const getMovieBySlug = async (slug) => apiRequest(`${PRODUCTIONS_API}/detail/${slug}`);

export const getMovieById = async (id) => apiRequest(`/api/v1/productions/${id}`);

// 2. THỂ LOẠI (GENRES)

export const getGenres = async () => apiRequest(`${PRODUCTIONS_API}/genres`);

// 3. QUẢN LÝ MÙA & TẬP (SEASONS & EPISODES)

export const getEpisodesBySeason = async (seasonId) =>
  apiRequest(`${EPISODES_API}/seasons/${seasonId}/episodes`);

export const createSeason = async (seriesId, data) =>
  apiRequest(`${EPISODES_API}/series/${seriesId}/seasons`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createEpisode = async (data) =>
  apiRequest(`${EPISODES_API}/`, { method: "POST", body: data });

export const updateEpisode = async (id, data) =>
  apiRequest(`${EPISODES_API}/${id}`, { method: "PUT", body: data });

export const deleteEpisode = async (id) => apiRequest(`${EPISODES_API}/${id}`, { method: "DELETE" });

export const getPopularMovies = async () => apiRequest(`${PRODUCTIONS_API}/popular`);
