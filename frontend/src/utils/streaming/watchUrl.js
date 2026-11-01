export const parseWatchPosition = (value) => {
  if (typeof value !== 'string' || !/^(?:\d+)(?:\.\d+)?$/.test(value)) return null;
  const position = Number(value);
  return Number.isFinite(position) && position >= 0 ? position : null;
};

export const createEpisodeWatchUrl = (episode, position = null) => {
  const productionId = Number(episode.watch_production_id);
  const number = Number(episode.episode_number);
  if (!Number.isSafeInteger(productionId) || productionId < 1 || !Number.isSafeInteger(number) || number < 1) return null;
  const query = new URLSearchParams();
  if (episode.season_number != null) {
    const season = Number(episode.season_number);
    if (!Number.isSafeInteger(season) || season < 1) return null;
    query.set('ss', String(season));
  }
  query.set('ep', String(number));
  if (position != null && Number.isFinite(position) && position >= 0) query.set('pos', String(position));
  return `/movies/${productionId}?${query}`;
};
