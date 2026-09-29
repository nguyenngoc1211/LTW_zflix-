import { Router } from "express";
import { requireAuth } from "../../core/middleware/auth.middleware.js";
import { requireFrontendOrigin } from "../../core/middleware/origin.middleware.js";
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  resetPasswordRateLimiter,
} from "../../core/middleware/rate-limit.middleware.js";
import {
  REFRESH_COOKIE,
  changePassword,
  clearRefreshCookieOptions,
  login,
  refresh,
  refreshCookieOptions,
  requestPasswordReset,
  resetPassword,
  revokeAllSessions,
  revokeSession,
} from "./auth.service.js";

export const authRouter = Router();

const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = (value) =>
  typeof value === "string" && value.length >= 8 && value.length <= 128;
const validCurrentPassword = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 128;
const forgotPasswordMessage =
  "If the email exists, password reset instructions have been sent";

authRouter.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!validEmail(email) || password.length === 0 || password.length > 128) {
      return res.status(400).json({ message: "A valid email and password are required" });
    }

    const result = await login(email, password, {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });
    if (result?.denied === "locked") {
      return res
        .status(429)
        .json({ message: "Unable to sign in right now. Please try again later" });
    }
    if (!result || result.denied) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    return res.json({ accessToken: result.accessToken, user: result.user });
  } catch (error) {
    return next(error);
  }
});

authRouter.post(
  "/refresh-token",
  requireFrontendOrigin,
  refreshRateLimiter,
  async (req, res, next) => {
    try {
      const currentToken = req.cookies[REFRESH_COOKIE];
      if (!currentToken) return res.status(401).json({ message: "Refresh session is missing" });

      const result = await refresh(currentToken);
      if (!result) {
        res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
        return res.status(401).json({ message: "Refresh session is invalid or expired" });
      }

      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
      return res.json({ accessToken: result.accessToken, user: result.user });
    } catch (error) {
      return next(error);
    }
  },
);

authRouter.post(
  "/change-password",
  requireAuth,
  requireFrontendOrigin,
  async (req, res, next) => {
    try {
      const currentPassword = req.body?.currentPassword;
      const newPassword = req.body?.newPassword;
      if (!validCurrentPassword(currentPassword) || !validPassword(newPassword)) {
        return res.status(400).json({ message: "Passwords must be between 8 and 128 characters" });
      }

      const result = await changePassword(req.user.id, currentPassword, newPassword);
      if (result.error === "invalid_current") {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      if (result.error === "same_password") {
        return res.status(400).json({ message: "New password must be different" });
      }

      res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
      return res.json({ message: "Password changed successfully. Please sign in again." });
    } catch (error) {
      return next(error);
    }
  },
);

authRouter.post("/forgot-password", forgotPasswordRateLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email) || email.length > 254) {
      return res.status(400).json({ message: "A valid email is required" });
    }

    await requestPasswordReset(email);
    return res.json({ message: forgotPasswordMessage });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/reset-password", resetPasswordRateLimiter, async (req, res, next) => {
  try {
    const token = req.body?.token;
    const newPassword = req.body?.newPassword;
    if (typeof token !== "string" || token.length === 0 || token.length > 512) {
      return res.status(400).json({ message: "Reset token is invalid or expired" });
    }
    if (!validPassword(newPassword)) {
      return res.status(400).json({ message: "Passwords must be between 8 and 128 characters" });
    }

    if (!(await resetPassword(token, newPassword))) {
      return res.status(400).json({ message: "Reset token is invalid or expired" });
    }

    res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
    return res.json({ message: "Password reset successfully. Please sign in again." });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/logout", requireFrontendOrigin, async (req, res, next) => {
  try {
    const authorization = req.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
    await revokeSession({
      refreshToken: req.cookies[REFRESH_COOKIE],
      accessToken,
    });
    res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

authRouter.post(
  "/logout-all",
  requireFrontendOrigin,
  requireAuth,
  async (req, res, next) => {
    try {
      await revokeAllSessions(req.user.id);
      res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  },
);

authRouter.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
