import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { securityConfig } from "./config/security.config.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { requireAuth, requireRole } from "./core/middleware/auth.middleware.js";

export const createApp = () => {
  const app = express();

  app.use(
    helmet({
      // A streaming-compatible CSP needs to be designed with the media hosts in a later phase.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      strictTransportSecurity: securityConfig.isProduction ? undefined : false,
    }),
  );
  app.use(cors({ origin: securityConfig.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());

  app.get("/", (req, res) => {
    res.json({ message: "Movie Streaming Backend", status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);

  app.get(
    "/api/v1/admin/check",
    requireAuth,
    requireRole("admin"),
    (req, res) => res.json({ message: "Admin access granted", user: req.user }),
  );

  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    return res.status(500).json({ message: "Internal server error" });
  });

  return app;
};

export default createApp();
