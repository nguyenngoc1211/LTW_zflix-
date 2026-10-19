export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const parsePositiveInt = (value, field = "id") => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    const error = new Error(`${field} must be a positive integer`);
    error.status = 400;
    throw error;
  }
  return parsed;
};

export const clampPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 12));
  return { page, limit, offset: (page - 1) * limit };
};
