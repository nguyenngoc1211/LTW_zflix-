import { rateLimit } from "express-rate-limit";
import { securityConfig } from "../../config/security.config.js";

const authenticationRateLimiter = ({ windowMs, max }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ message: "Too many authentication requests. Please try again later" }),
  });

export const loginRateLimiter = authenticationRateLimiter(securityConfig.loginRateLimit);
export const refreshRateLimiter = authenticationRateLimiter(securityConfig.refreshRateLimit);
export const forgotPasswordRateLimiter = authenticationRateLimiter(
  securityConfig.forgotPasswordRateLimit,
);
export const resetPasswordRateLimiter = authenticationRateLimiter(
  securityConfig.resetPasswordRateLimit,
);
export const mfaRateLimiter = authenticationRateLimiter(securityConfig.mfa.rateLimit);
