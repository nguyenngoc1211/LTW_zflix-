import { Router } from "express";
import { Readable } from "node:stream";

// Proxy HLS từ Cloudflare R2 qua backend để trình duyệt không bị chặn CORS.
// Bucket public không cấu hình được CORS (key hiện tại không có quyền Bucket Settings).
export const r2ProxyRouter = Router();

const publicDomain = () => (process.env.R2_PUBLIC_DOMAIN || "").replace(/\/+$/, "");

r2ProxyRouter.use(async (req, res, next) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).json({ message: "Method not allowed" });
    }
    const domain = publicDomain();
    if (!domain) return res.status(503).json({ message: "R2 public domain is not configured" });

    const path = req.url;
    if (!path || path === "/" || path.includes("..") || path.includes("\\")) {
      return res.status(400).json({ message: "Invalid HLS path" });
    }

    const upstream = await fetch(`${domain}${path}`, {
      method: req.method,
      headers: req.headers.range ? { Range: req.headers.range } : undefined,
    });

    res.status(upstream.status);
    const headers = ["content-type", "content-length", "content-range", "accept-ranges", "etag"];
    for (const name of headers) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader("Cache-Control", "public, max-age=300");

    if (req.method === "HEAD" || !upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    next(error);
  }
});
