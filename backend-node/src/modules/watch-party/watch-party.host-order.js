export const selectNextHost = (participants, leavingUserId = null) => (
  [...participants]
    .filter((participant) => Number(participant.user_id) !== Number(leavingUserId))
    .sort((left, right) => (
      new Date(left.joined_at).getTime() - new Date(right.joined_at).getTime()
      || Number(left.user_id) - Number(right.user_id)
    ))[0] || null
);
