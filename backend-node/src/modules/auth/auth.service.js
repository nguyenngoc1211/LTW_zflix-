import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../core/database/pool.js";

export const REFRESH_COOKIE = "refreshToken";

const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || "15m";
const refreshTokenDays = Number(process.env.REFRESH_TOKEN_DAYS) || 7;

const refreshExpiry = () => new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000);
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const newRefreshToken = () => crypto.randomBytes(48).toString("base64url");

const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  avatarUrl: row.avatar_url,
  role: row.role,
});

const signAccessToken = (user, sessionId) =>
  jwt.sign(
    { role: user.role, sid: sessionId },
    process.env.JWT_ACCESS_SECRET,
    { subject: String(user.id), expiresIn: accessTokenTtl },
  );

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/v1/auth",
  maxAge: refreshTokenDays * 24 * 60 * 60 * 1000,
});

export const clearRefreshCookieOptions = () => {
  const { maxAge, ...options } = refreshCookieOptions();
  return options;
};

export const login = async (email, password, metadata = {}) => {
  const [users] = await pool.execute(
    `SELECT id, username, email, password, avatar_url, role, provider
     FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  const user = users[0];

  if (!user || user.provider !== "local" || !user.password) return null;
  if (!(await bcrypt.compare(password, user.password))) return null;

  const sessionId = crypto.randomUUID();
  const refreshToken = newRefreshToken();
  const expiresAt = refreshExpiry();

  await pool.execute(
    `INSERT INTO auth_sessions
       (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      user.id,
      hashToken(refreshToken),
      metadata.userAgent?.slice(0, 255) || null,
      metadata.ipAddress?.slice(0, 45) || null,
      expiresAt,
    ],
  );
  await pool.execute("UPDATE users SET last_login = UTC_TIMESTAMP() WHERE id = ?", [user.id]);

  return {
    accessToken: signAccessToken(user, sessionId),
    refreshToken,
    user: publicUser(user),
  };
};

export const refresh = async (currentToken) => {
  const currentHash = hashToken(currentToken);
  const [rows] = await pool.execute(
    `SELECT s.id AS session_id, u.id, u.username, u.email, u.avatar_url, u.role
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [currentHash],
  );
  const user = rows[0];
  if (!user) return null;

  const nextToken = newRefreshToken();
  const [result] = await pool.execute(
    `UPDATE auth_sessions
     SET refresh_token_hash = ?, expires_at = ?, last_used_at = UTC_TIMESTAMP()
     WHERE id = ? AND refresh_token_hash = ? AND revoked_at IS NULL`,
    [hashToken(nextToken), refreshExpiry(), user.session_id, currentHash],
  );
  if (result.affectedRows !== 1) return null;

  return {
    accessToken: signAccessToken(user, user.session_id),
    refreshToken: nextToken,
    user: publicUser(user),
  };
};

export const revokeSession = async ({ refreshToken, accessToken }) => {
  if (refreshToken) {
    await pool.execute(
      "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE refresh_token_hash = ? AND revoked_at IS NULL",
      [hashToken(refreshToken)],
    );
  }

  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET, {
        ignoreExpiration: true,
      });
      await pool.execute(
        "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL",
        [payload.sid],
      );
    } catch {
      // Logout remains idempotent when the supplied access token is malformed.
    }
  }
};
