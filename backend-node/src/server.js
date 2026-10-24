import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { pool } from "./core/database/pool.js";
import { setSecurityLogSink } from "./core/security/security-logger.js";
import { syncProductionIndex } from "./modules/discovery/search.service.js";
import { registerWatchPartySocket } from "./modules/watch-party/watch-party.socket.js";

// Lưu log bảo mật vào bảng security_events (song song với console)
setSecurityLogSink((line) => {
  try {
    const record = JSON.parse(line);
    pool
      .execute(
        "INSERT INTO security_events (event, user_id, session_id, ip, user_agent, reason, factor) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          record.event,
          record.userId ?? null,
          record.sessionId ?? null,
          record.ip ?? null,
          record.userAgent ?? null,
          record.reason ?? null,
          record.factor ?? null,
        ],
      )
      .catch(() => {});
  } catch {
    // dòng log không phải JSON — bỏ qua
  }
});

const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// Tạo HTTP server từ Express app để dùng chung cho Socket.IO
const httpServer = createServer(app);

// Khởi tạo Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
});

// Đăng ký Watch Party socket handler
registerWatchPartySocket(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO ready for connections`);
  syncProductionIndex().then((count) => console.log(`Search index ready (${count} productions)`));
});
