import "dotenv/config";
import express from "express";
import cors from "cors";
import { watchPartyRouter } from "./modules/watch-party/watch-party.routes.js";

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173", credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.get("/", (req, res) => res.json({ message: "Zflix API", status: "ok" }));
  app.use("/api/v1", watchPartyRouter);
  app.use((req, res) => res.status(404).json({ message: "Route not found" }));
  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Internal server error" });
  });
  return app;
};

export default createApp();
