import { pool } from "../database/pool.js";

let authModule = null;

try {
  authModule = await import("./auth.middleware.js");
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

// Development fallback khi chưa merge auth.middleware từ branch Du
const devFallbackAuth = async (req, res, next) => {
  try {
    // Cho phép client truyền x-user-id để test chuyển đổi giữa nhiều user (host, guest)
    const rawUserId = req.headers["x-user-id"] || "1";
    const userId = Number(rawUserId) || 1;

    const [rows] = await pool.execute(
      "SELECT id, username, email, avatar_url, role FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (rows.length > 0) {
      req.user = {
        id: rows[0].id,
        username: rows[0].username,
        email: rows[0].email,
        avatarUrl: rows[0].avatar_url,
        role: rows[0].role,
      };
    } else {
      req.user = {
        id: userId,
        username: `User_${userId}`,
        email: `user${userId}@zflix.local`,
        avatarUrl: null,
        role: userId === 1 ? "admin" : "user",
      };
    }

    req.auth = { sessionId: `dev-session-${userId}` };
    next();
  } catch (err) {
    console.error("[AuthBridge] Dev fallback error:", err);
    // Vẫn cấp quyền user mặc định nếu DB tạm thời chưa kết nối
    req.user = { id: 1, username: "admin", email: "admin@zflix.local", role: "admin" };
    req.auth = { sessionId: "dev-session-fallback" };
    next();
  }
};

const devFallbackRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

export const requireAuth = authModule?.requireAuth || devFallbackAuth;
export const requireRole = authModule?.requireRole || devFallbackRole;

