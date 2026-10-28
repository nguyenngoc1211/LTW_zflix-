import { pool } from "../../core/database/pool.js";
import { buildPlaybackUrl } from "../../core/security/playback-token.js";
import { canAccessPremium } from "../../core/security/entitlements.js";

// Premium nằm trên production gốc của series; season chỉ là vỏ production con.
export const resolveProductionPremium = async (productionId) => {
  if (!productionId) return false;
  const [rows] = await pool.execute(
    `SELECT p.is_premium, sp.is_premium AS series_premium
     FROM productions p
     LEFT JOIN seasons s ON s.id = p.id
     LEFT JOIN productions sp ON sp.id = s.series_id
     WHERE p.id = ? LIMIT 1`,
    [productionId],
  );
  if (!rows.length) return false;
  return Boolean(rows[0].is_premium) || Boolean(rows[0].series_premium);
};

export const isPremiumLocked = (premium, user) =>
  Boolean(premium) && !canAccessPremium(user);

export const applyEpisodeAccess = (episode, { premium, user }) => ({
  ...episode,
  video_url: buildPlaybackUrl(episode.video_url, { premium, user }),
  locked: isPremiumLocked(premium, user),
});
