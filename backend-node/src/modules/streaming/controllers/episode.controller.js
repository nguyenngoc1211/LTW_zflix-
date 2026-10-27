import {
  getEpisodesBySeasonService,
  createEpisodeService,
  updateEpisodeService,
  deleteEpisodeService,
  createSeasonService,
  updateVideoWebhookService,
} from "../services/episode.service.js";

export const getEpisodesBySeasonController = async (req, res) => {
  try {
    const episodes = await getEpisodesBySeasonService(req.params.seasonId);
    res.json({ data: episodes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createSeasonController = async (req, res) => {
  try {
    const season = await createSeasonService(req.params.seriesId, req.body);
    res.json({ message: "Thêm mùa thành công!", data: season });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createEpisodeController = async (req, res) => {
  try {
    const episode = await createEpisodeService(req.body, req.file);
    res.json({ message: "Thêm tập thành công!", data: episode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateEpisodeController = async (req, res) => {
  try {
    const episode = await updateEpisodeService(
      req.params.id,
      req.body,
      req.file,
    );
    res.json({ message: "Cập nhật tập thành công!", data: episode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteEpisodeController = async (req, res) => {
  try {
    await deleteEpisodeService(req.params.id);
    res.json({ message: "Xóa tập thành công!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
