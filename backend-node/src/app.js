import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { securityConfig } from "./config/security.config.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { discoveryRouter } from "./modules/discovery/discovery.routes.js";
import { communityRouter } from "./modules/community/community.routes.js";
import { streamingRouter } from "./modules/streaming/streaming.routes.js";
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
    res.json({ message: "Zflix API", status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", discoveryRouter);
  app.use("/api/v1", communityRouter);
  app.use("/api/v1", streamingRouter);

  app.get(
    "/api/v1/admin/check",
    requireAuth,
    requireRole("admin"),
    (req, res) => res.json({ message: "Admin access granted", user: req.user }),
  );

  app.use((req, res) => res.status(404).json({ message: "Route not found" }));
  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Internal server error" });
  });

  return app;
};

export default createApp();
