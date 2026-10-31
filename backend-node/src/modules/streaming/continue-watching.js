export const selectContinueWatching = (items) => {
  const seenProductions = new Set();

  return items.filter((item) => {
    if (Number(item.is_completed) !== 0 || Number(item.last_position) <= 0) return false;
    if (seenProductions.has(item.production_id)) return false;
    seenProductions.add(item.production_id);
    return true;
  });
};
