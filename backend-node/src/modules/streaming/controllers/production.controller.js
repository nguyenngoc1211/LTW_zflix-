import {
  uploadMovieService,
  getMoviesService,
  getMovieBySlugService,
  getGenresService,
  updateProductionService,
  deleteProductionService,
  getPopularMoviesService,
} from "../services/production.service.js";

export const uploadMovieController = async (req, res) => {
  try {
    const { type } = req.body;
    if (!req.file && (!type || type === "movie")) {
      console.log("⚠️ [400 Bad Request]: Không nhận được file video từ FE cho phim lẻ!");
      return res.status(400).send("Chưa chọn file video cho phim lẻ!");
    }
    const result = await uploadMovieService(req.file, req.body);
    res.json({
      message: type === "series" ? "Tạo phim bộ thành công!" : "Upload thành công! Đang xử lý video ngầm.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getListMoviesController = async (req, res) => {
  try {
    const movies = await getMoviesService();
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMovieBySlugController = async (req, res) => {
  try {
    const movie = await getMovieBySlugService(req.params.slug);
    res.json(movie);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};

export const getGenresController = async (req, res) => {
  try {
    const genres = await getGenresService();
    res.json(genres);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProductionController = async (req, res) => {
  try {
    const result = await updateProductionService(req.params.id, req.body);
    res.json({ message: "Cập nhật thành công!", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProductionController = async (req, res) => {
  try {
    await deleteProductionService(req.params.id);
    res.json({ message: "Đã xóa phim thành công!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const getPopularMoviesController = async (req, res) => {
  try {
    const popularMovies = await getPopularMoviesService();
    res.json(popularMovies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
