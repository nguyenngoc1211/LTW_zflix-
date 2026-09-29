import jwt from "jsonwebtoken";
import { securityConfig } from "../../config/security.config.js";
import { pool } from "../database/pool.js";

const unauthorized = (res, message = "Authentication required") =>
  res.status(401).json({ message });

export const requireAuth = async (req, res, next) => {
  try {
    const authorization = req.get("authorization") || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) return unauthorized(res);

    const payload = jwt.verify(token, securityConfig.jwtAccessSecret, {
      algorithms: securityConfig.jwtAlgorithms,
    });
    const [sessions] = await pool.execute(
      `SELECT s.id, u.id AS user_id, u.username, u.email, u.avatar_url, u.role
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [payload.sid, payload.sub],
    );

    if (sessions.length === 0) return unauthorized(res, "Session is invalid or expired");

    const session = sessions[0];
    req.auth = { sessionId: session.id };
    req.user = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      avatarUrl: session.avatar_url,
      role: session.role,
    };
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return unauthorized(res, "Access token is invalid or expired");
    }
    return next(error);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission to access this resource" });
  }
  return next();
};
