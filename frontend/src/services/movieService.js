import axios from "axios";

const API_URL = import.meta.env.VITE_STREAMING_API_URL;

const PRODUCTIONS_API = `${API_URL}/productions`;
const EPISODES_API = `${API_URL}/episodes`;

// 1. QUẢN LÝ PHIM (PRODUCTIONS)

export const uploadMovie = async (formData) => {
  const response = await axios.post(
    `${PRODUCTIONS_API}/upload-video`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
};

export const updateProduction = async (id, formData) => {
  const res = await axios.put(`${PRODUCTIONS_API}/update/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const deleteProduction = async (id) => {
  const res = await axios.delete(`${PRODUCTIONS_API}/delete/${id}`);
  return res.data;
};

export const getMovies = async () => {
  const response = await axios.get(`${PRODUCTIONS_API}/list`);
  return response.data;
};

export const getMovieBySlug = async (slug) => {
  const response = await axios.get(`${PRODUCTIONS_API}/detail/${slug}`);
  return response.data;
};

// 2. THỂ LOẠI (GENRES)

export const getGenres = async () => {
  const res = await axios.get(`${PRODUCTIONS_API}/genres`);
  return res.data;
};

// 3. QUẢN LÝ MÙA & TẬP (SEASONS & EPISODES)

export const getEpisodesBySeason = async (seasonId) => {
  const res = await axios.get(`${EPISODES_API}/seasons/${seasonId}/episodes`);
  return res.data;
};

export const createSeason = async (seriesId, data) => {
  const res = await axios.post(
    `${EPISODES_API}/series/${seriesId}/seasons`,
    data,
  );
  return res.data;
};

export const createEpisode = async (data) => {
  const res = await axios.post(`${EPISODES_API}/`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const updateEpisode = async (id, data) => {
  const res = await axios.put(`${EPISODES_API}/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const deleteEpisode = async (id) => {
  const res = await axios.delete(`${EPISODES_API}/${id}`);
  return res.data;
};

export const getPopularMovies = async () => {
  const response = await axios.get(`${PRODUCTIONS_API}/popular`);
  return response.data;
};
