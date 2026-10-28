import jwt from "jsonwebtoken";
import { securityConfig } from "../../config/security.config.js";
import { pool } from "../database/pool.js";
import { securityLog } from "../security/security-logger.js";

const unauthorized = (req, res, message = "Authentication required", reason = "missing") => {
  securityLog("ACCESS_DENIED", {
    ip: req.ip,
    userAgent: req.get("user-agent"),
    reason,
  });
  return res.status(401).json({ message });
};

const loadSessionUser = async (token) => {
  const payload = jwt.verify(token, securityConfig.jwtAccessSecret, {
    algorithms: securityConfig.jwtAlgorithms,
  });
  const [sessions] = await pool.execute(
    `SELECT s.id, u.id AS user_id, u.username, u.email, u.avatar_url, u.role,
            u.vip_expires_at
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.user_id = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > UTC_TIMESTAMP()
       AND s.absolute_expires_at > UTC_TIMESTAMP()
       AND u.status = 'active'
     LIMIT 1`,
    [payload.sid, payload.sub],
  );

  if (sessions.length === 0) return null;

  const session = sessions[0];
  return {
    sessionId: session.id,
    user: {
      id: session.user_id,
      username: session.username,
      email: session.email,
      avatarUrl: session.avatar_url,
      role: session.role,
      vipExpiresAt: session.vip_expires_at,
    },
  };
};

const isTokenError = (error) =>
  error.name === "JsonWebTokenError" || error.name === "TokenExpiredError";

export const requireAuth = async (req, res, next) => {
  try {
    const authorization = req.get("authorization") || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) return unauthorized(req, res);

    const session = await loadSessionUser(token);
    if (!session) {
      return unauthorized(req, res, "Session is invalid or expired", "invalid_session");
    }

    req.auth = { sessionId: session.sessionId };
    req.user = session.user;
    return next();
  } catch (error) {
    if (isTokenError(error)) {
      return unauthorized(req, res, "Access token is invalid or expired", "invalid_token");
    }
    return next(error);
  }
};

// Dùng cho endpoint đọc công khai nhưng cần biết người xem có VIP hay không.
// Thiếu token hoặc token hỏng đều coi là khách, không chặn request.
export const optionalAuth = async (req, res, next) => {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return next();

  try {
    const session = await loadSessionUser(token);
    if (session) {
      req.auth = { sessionId: session.sessionId };
      req.user = session.user;
    }
    return next();
  } catch (error) {
    if (isTokenError(error)) return next();
    return next(error);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    securityLog("ADMIN_ACCESS_DENIED", {
      userId: req.user?.id,
      sessionId: req.auth?.sessionId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      reason: "insufficient_role",
    });
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  return next();
};
