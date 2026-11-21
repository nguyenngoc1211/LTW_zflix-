export const commentRequestHeaders = (pending, body) => {
  if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
  return { 'Idempotency-Key': pending.current.key };
};

export const clearCommentRequest = (pending) => { pending.current = null; };

export const commentPayload = ({ content, imageFile, ...fields }) => {
  const values = { content: content.trim(), ...fields };
  if (!imageFile) return { body: JSON.stringify(values), signature: JSON.stringify(values) };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null) form.append(key, String(value));
  form.append('image', imageFile);
  return { body: form, signature: JSON.stringify({ ...values, image: [imageFile.name, imageFile.size, imageFile.lastModified] }) };
};
