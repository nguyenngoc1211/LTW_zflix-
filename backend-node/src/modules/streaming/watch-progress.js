export const WATCH_COMPLETION_PERCENT = 90;
export const WATCH_COMPLETION_TOLERANCE_SECONDS = 5;

const nonNegativeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const resolveWatchProgress = ({ position, duration, completed = false }) => {
  const mediaDuration = nonNegativeNumber(duration);
  const requestedPosition = nonNegativeNumber(position);
  const safePosition = mediaDuration
    ? Math.min(requestedPosition, mediaDuration)
    : requestedPosition;
  const watchedPercent = mediaDuration
    ? Math.min(100, safePosition / mediaDuration * 100)
    : 0;
  const reachedCompletionThreshold = watchedPercent >= WATCH_COMPLETION_PERCENT;
  const reachedMediaEnd = mediaDuration > 0
    && safePosition >= Math.max(0, mediaDuration - WATCH_COMPLETION_TOLERANCE_SECONDS);
  const isCompleted = completed === true || reachedCompletionThreshold || reachedMediaEnd;

  return {
    position: isCompleted && mediaDuration ? mediaDuration : safePosition,
    watchedPercent: isCompleted ? 100 : watchedPercent,
    completed: isCompleted,
  };
};
