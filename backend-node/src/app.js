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
import { watchPartyRouter } from "./modules/watch-party/watch-party.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { adminContentRouter } from "./modules/admin/admin.content.routes.js";
import { adminModerationRouter } from "./modules/admin/admin.moderation.routes.js";
import { adminSystemRouter } from "./modules/admin/admin.system.routes.js";
import { shoppingRouter } from "./modules/shopping/shopping.routes.js";
import { requireAuth } from "./core/middleware/auth.middleware.js";
import { pool } from "./core/database/pool.js";

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
  app.use(cors({ origin: securityConfig.frontendOrigins, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());

  app.get("/", (req, res) => {
    res.json({ message: "Zflix API", status: "ok" });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", discoveryRouter);
  app.use("/api/v1", communityRouter);
  app.use("/api/v1", streamingRouter);
  app.use("/api/v1", watchPartyRouter);
  app.use("/api/v1", shoppingRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/admin", adminContentRouter);
  app.use("/api/v1/admin", adminModerationRouter);
  app.use("/api/v1/admin", adminSystemRouter);

  // Banner phim nổi bật trên trang chủ (công khai, đọc từ app_settings)
  app.get("/api/v1/settings/featured", async (req, res) => {
    try {
      const [rows] = await pool.execute("SELECT setting_value FROM app_settings WHERE setting_key = 'featured_production_id' LIMIT 1");
      if (!rows.length) return res.json({ featuredProductionId: null, production: null });
      const productionId = Number(rows[0].setting_value);
      const [productions] = await pool.execute(
        "SELECT id, title, description, banner_url, poster_url, release_year, type FROM productions WHERE id = ? LIMIT 1",
        [productionId],
      );
      res.json({ featuredProductionId: productionId, production: productions[0] || null });
    } catch {
      res.json({ featuredProductionId: null, production: null });
    }
  });

  // Kiểm tra quyền vào hệ quản trị: admin hoặc moderator
  app.get(
    "/api/v1/admin/check",
    requireAuth,
    (req, res, next) => {
      if (!["admin", "moderator"].includes(req.user?.role)) {
        return res.status(403).json({ message: "You do not have permission to access this resource" });
      }
      return next();
    },
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
