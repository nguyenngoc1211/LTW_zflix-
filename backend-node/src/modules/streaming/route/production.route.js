import express from "express";
import multer from "multer";
import {
  uploadMovieController,
  getListMoviesController,
  getMovieBySlugController,
  getGenresController,
  updateProductionController,
  deleteProductionController,
  getPopularMoviesController,
} from "../controllers/production.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/popular", getPopularMoviesController);
router.get("/genres", getGenresController);
router.get("/list", getListMoviesController);
router.get("/detail/:slug", getMovieBySlugController);

router.post("/upload-video", upload.single("video"), uploadMovieController);
router.put("/update/:id", upload.any(), updateProductionController);
router.delete("/delete/:id", deleteProductionController);

export default router;
