import { Router } from "express";
import { Readable } from "node:stream";
import { verifyPlaybackToken } from "../../core/security/playback-token.js";

// Proxy HLS từ Cloudflare R2 qua backend để trình duyệt không bị chặn CORS.
// Bucket public không cấu hình được CORS (key hiện tại không có quyền Bucket Settings).
// Mọi request phải kèm playback token ngắn hạn do backend cấp trong video_url.
export const r2ProxyRouter = Router();

const publicDomain = () => (process.env.R2_PUBLIC_DOMAIN || "").replace(/\/+$/, "");

r2ProxyRouter.use(async (req, res, next) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).json({ message: "Method not allowed" });
    }
    const domain = publicDomain();
    if (!domain) return res.status(503).json({ message: "R2 public domain is not configured" });

    const [rawPath, query] = (req.url || "").split("?");
    const match = rawPath.match(/^\/t\/([^/]+)\/(.+)$/);
    if (!match) return res.status(403).json({ message: "Playback token is required" });

    const [, token, objectPath] = match;
    if (objectPath.includes("..") || objectPath.includes("\\")) {
      return res.status(400).json({ message: "Invalid HLS path" });
    }
    if (!/^(hls|raw)\//.test(objectPath)) {
      return res.status(403).json({ message: "Invalid HLS path" });
    }
    if (!verifyPlaybackToken(token, objectPath)) {
      return res.status(403).json({ message: "Playback link is invalid or expired" });
    }

    const upstream = await fetch(`${domain}/${objectPath}${query ? `?${query}` : ""}`, {
      method: req.method,
      headers: req.headers.range ? { Range: req.headers.range } : undefined,
    });

    res.status(upstream.status);
    const headers = ["content-type", "content-length", "content-range", "accept-ranges", "etag"];
    for (const name of headers) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader("Cache-Control", "private, max-age=300");

    if (req.method === "HEAD" || !upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    next(error);
  }
});
