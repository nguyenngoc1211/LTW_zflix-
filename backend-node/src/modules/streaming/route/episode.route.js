import express from "express";
import multer from "multer";

import {
  getEpisodesBySeasonController,
  createEpisodeController,
  updateEpisodeController,
  deleteEpisodeController,
  createSeasonController,
} from "../controllers/episode.controller.js";

import { webhookVideoController } from "../controllers/webhook.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/seasons/:seasonId/episodes", getEpisodesBySeasonController);
router.post(
  "/series/:seriesId/seasons",
  express.json(),
  createSeasonController,
);

router.post("/", upload.single("video"), createEpisodeController);
router.put("/:id", upload.single("video"), updateEpisodeController);
router.delete("/:id", deleteEpisodeController);

// Đoạn này sẽ hứng request từ: /api/streaming/episodes/webhook/video-done
router.post("/webhook/video-done", express.json(), webhookVideoController);

export default router;
