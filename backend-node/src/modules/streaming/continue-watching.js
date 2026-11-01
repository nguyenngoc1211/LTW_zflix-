export const selectContinueWatching = (items) => {
  const seenProductions = new Set();

  return items.filter((item) => {
    if (Number(item.is_completed) !== 0 || Number(item.last_position) <= 0) return false;
    const productionId = item.watch_production_id ?? item.production_id;
    if (seenProductions.has(productionId)) return false;
    seenProductions.add(productionId);
    return true;
  });
};
