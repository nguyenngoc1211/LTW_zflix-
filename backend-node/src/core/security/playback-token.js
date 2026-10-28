import crypto from "node:crypto";
import { securityConfig } from "../../config/security.config.js";
import { canAccessPremium } from "./entitlements.js";

// Token nằm trong path (không phải query) để hls.js tự động gửi kèm khi tải
// các segment tương đối của playlist.
const TOKEN_TTL_SECONDS = 10 * 60;
const PROXY_PREFIX = "/api/v1/hls/t/";

const secret = () => process.env.PLAYBACK_TOKEN_SECRET || securityConfig.jwtAccessSecret;

const sign = (exp, scope) =>
  crypto.createHmac("sha256", secret()).update(`${exp}.${scope}`).digest("base64url");

const r2Host = () => (process.env.R2_PUBLIC_DOMAIN || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();

export const toObjectPath = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, "") || null;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const domain = r2Host();
    if (host.endsWith(".r2.dev") || (domain && host === domain)) {
      return parsed.pathname.replace(/^\/+/, "") || null;
    }
  } catch {
    return null;
  }
  return null;
};

// Playlist cần token dùng chung cho cả thư mục; file lẻ (mp4) khóa đúng path.
const scopeOf = (objectPath) =>
  objectPath.endsWith(".m3u8") ? objectPath.slice(0, objectPath.lastIndexOf("/") + 1) : objectPath;

export const createPlaybackToken = (scope, { now = Date.now(), ttlSeconds = TOKEN_TTL_SECONDS } = {}) => {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ exp, scope })).toString("base64url");
  return `${payload}.${sign(exp, scope)}`;
};

export const verifyPlaybackToken = (token, objectPath, now = Date.now()) => {
  if (typeof token !== "string" || !objectPath) return false;
  if (objectPath.includes("..") || objectPath.includes("\\")) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (!parsed || typeof parsed.scope !== "string" || !Number.isInteger(parsed.exp)) return false;
  if (parsed.exp * 1000 <= now) return false;

  const expected = Buffer.from(sign(parsed.exp, parsed.scope));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return false;

  return parsed.scope.endsWith("/")
    ? objectPath.startsWith(parsed.scope)
    : objectPath === parsed.scope;
};

// Trả URL phát qua backend kèm token; premium và không đủ quyền thì trả null
// để endpoint báo `locked` thay vì lộ link.
export const buildPlaybackUrl = (value, { premium = false, user = null } = {}) => {
  if (!value) return null;
  if (premium && !canAccessPremium(user)) return null;

  const objectPath = toObjectPath(value);
  if (!objectPath) {
    // URL ngoài R2 không proxy/gắn token được; chỉ trả cho nội dung miễn phí.
    return premium ? null : value;
  }

  const token = createPlaybackToken(scopeOf(objectPath));
  return `${PROXY_PREFIX}${token}/${objectPath}`;
};
