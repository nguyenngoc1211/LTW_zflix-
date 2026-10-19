let authModule = null;

try {
  authModule = await import("./auth.middleware.js");
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

const authUnavailable = (req, res) => res.status(503).json({
  message: "Authentication module is not integrated. Merge branch Du into Hai to enable this API.",
  code: "AUTH_MODULE_NOT_INTEGRATED",
});

export const requireAuth = authModule?.requireAuth || authUnavailable;
export const requireRole = authModule?.requireRole || (() => authUnavailable);
