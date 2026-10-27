import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { securityConfig } from "./config/security.config.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { discoveryRouter } from "./modules/discovery/discovery.routes.js";
import { communityRouter } from "./modules/community/community.routes.js";
import { streamingRouter } from "./modules/streaming/streaming.routes.js";
import streamingContentRouter from "./modules/streaming/route/index.js";
import { watchPartyRouter } from "./modules/watch-party/watch-party.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { adminContentRouter } from "./modules/admin/admin.content.routes.js";
import { adminModerationRouter } from "./modules/admin/admin.moderation.routes.js";
import { adminSystemRouter } from "./modules/admin/admin.system.routes.js";
import { shoppingRouter } from "./modules/shopping/shopping.routes.js";
import { visualShoppingRouter } from "./modules/visual-shopping/visual-shopping.routes.js";
import { scanRouter } from "./modules/visual-shopping/scan.routes.js";
import { requireAuth } from "./core/middleware/auth.middleware.js";
import { pool } from "./core/database/pool.js";

export const createApp = () => {
  const app = express();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // Ảnh người dùng chụp khi quét (cần public khi deploy để SerpAPI đọc)
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
  // Route ảnh base64 (visual shopping) cần limit lớn hơn — đặt TRƯỚC parser global;
  // body-parser bỏ qua nếu req._body đã set, nên không parse 2 lần
  app.use("/api/v1/visual-search", express.json({ limit: "5mb" }));
  app.use("/api/v1/scan", express.json({ limit: "5mb" }));
  app.use("/api/v1/shopping/admin/catalog", express.json({ limit: "5mb" }));
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
  app.use("/api/v1", visualShoppingRouter);
  app.use("/api/v1", scanRouter);
  app.use("/api/v1/admin", adminRouter);
  app.use("/api/v1/admin", adminContentRouter);
  app.use("/api/v1/admin", adminModerationRouter);
  app.use("/api/v1/admin", adminSystemRouter);

  // Quản lý phim/tập nâng cao (Prisma + R2, từ nhánh Nam) — chỉ admin/moderator.
  // Webhook do video-processor gọi nội bộ nên xác thực bằng secret riêng.
  const requireContentStaff = (req, res, next) => {
    if (!["admin", "moderator"].includes(req.user?.role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource" });
    }
    next();
  };
  const verifyVideoWebhook = (req, res, next) => {
    const expected = process.env.VIDEO_WEBHOOK_SECRET || "";
    const received = req.get("x-webhook-secret") || "";
    if (!expected || received !== expected) {
      return res.status(401).json({ message: "Invalid webhook secret" });
    }
    next();
  };
  app.use("/api/streaming/episodes/webhook", verifyVideoWebhook);
  app.use(
    "/api/streaming",
    (req, res, next) => {
      if (req.originalUrl.startsWith("/api/streaming/episodes/webhook/")) return next();
      return requireAuth(req, res, () => requireContentStaff(req, res, next));
    },
    streamingContentRouter,
  );

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
