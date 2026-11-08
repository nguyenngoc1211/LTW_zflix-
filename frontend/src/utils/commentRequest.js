export const commentRequestHeaders = (pending, body) => {
  if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
  return { 'Idempotency-Key': pending.current.key };
};

export const clearCommentRequest = (pending) => { pending.current = null; };
