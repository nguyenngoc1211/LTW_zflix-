import { securityConfig } from "../../config/security.config.js";

export const requireFrontendOrigin = (req, res, next) => {
  const origin = req.get("origin");
  if (!securityConfig.frontendOrigins.includes(origin)) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }
  return next();
};
