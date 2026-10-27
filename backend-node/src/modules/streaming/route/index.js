import express from "express";
import productionRoutes from "./production.route.js";
import episodeRoutes from "./episode.route.js";

const router = express.Router();

router.use("/productions", productionRoutes);
router.use("/episodes", episodeRoutes);

export default router;
