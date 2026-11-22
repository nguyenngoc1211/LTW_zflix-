import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { securityConfig } from "./config/security.config.js";
import { pool } from "./core/database/pool.js";
import { mongoCollection, nextNumericId } from "./core/database/mongo.js";
import { setSecurityLogSink } from "./core/security/security-logger.js";
import { syncProductionIndex } from "./modules/discovery/search.service.js";
import { registerWatchPartySocket, authenticateSocket } from "./modules/watch-party/watch-party.socket.js";
import { ensureNotificationIndexes, setNotificationNamespace } from "./modules/community/notification.service.js";
import { ensureEpisodeNotificationJobIndex, processEpisodeNotificationJobs } from './modules/community/episode-notification.job.js';
import { processExpiredVipNotifications } from './modules/community/vip-expiration.job.js';
import { closeMonth, monthKey } from './modules/community/points.service.js';

// Lưu log bảo mật vào bảng security_events (song song với console)
setSecurityLogSink((line) => {
  try {
    const record = JSON.parse(line);
    if (process.env.DATA_STORE === "mongodb") {
      nextNumericId("security_events")
        .then(async (id) => (await mongoCollection("security_events")).insertOne({
          _id: id, id, event: record.event, user_id: record.userId ?? null,
          session_id: record.sessionId ?? null, ip: record.ip ?? null,
          user_agent: record.userAgent ?? null, reason: record.reason ?? null,
          factor: record.factor ?? null, created_at: new Date(),
        }))
        .catch(() => {});
      return;
    }
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

// Tạo HTTP server từ Express app để dùng chung cho Socket.IO
const httpServer = createServer(app);

// Khởi tạo Socket.IO — dùng chung danh sách origin với Express CORS
// (FRONTEND_ORIGIN có thể chứa nhiều origin, phải truyền dạng mảng).
const io = new Server(httpServer, {
  cors: {
    origin: securityConfig.frontendOrigins,
    credentials: true,
  },
});

// Đăng ký Watch Party socket handler
const watchPartyNamespace = registerWatchPartySocket(io);
app.set("watchPartyNamespace", watchPartyNamespace);
const notificationNamespace = io.of('/notifications');
notificationNamespace.use(authenticateSocket);
notificationNamespace.on('connection', (socket) => socket.join(`user:${socket.data.userId}`));
setNotificationNamespace(notificationNamespace);
if (process.env.DATA_STORE === 'mongodb') ensureNotificationIndexes().catch((error) => console.error('Notification indexes:', error));
if (process.env.DATA_STORE === 'mongodb') ensureEpisodeNotificationJobIndex().catch((error) => console.error('Notification job index:', error));
if (process.env.DATA_STORE === 'mongodb') {
  // Close only the previous month. Rewards remain pending until an admin approves them.
  const closePreviousMonth = () => {
    const [year, month] = monthKey().split('-').map(Number);
    const prior = monthKey(new Date(Date.UTC(year, month - 1, 0, 12)));
    return closeMonth(prior).catch((error) => console.error('Points month close:', error));
  };
  if (process.env.POINTS_MONTH_CLOSE_ENABLED !== 'false') {
    const pointsWorker = setInterval(closePreviousMonth, 3600000);
    pointsWorker.unref();
    closePreviousMonth();
  }
  const worker = setInterval(() => processEpisodeNotificationJobs().catch((error) => console.error('Notification job:', error)), 5000);
  worker.unref();
  const vipWorker = setInterval(() => processExpiredVipNotifications().catch((error) => console.error('VIP notification job:', error)), 3600000);
  vipWorker.unref();
  processExpiredVipNotifications().catch((error) => console.error('VIP notification job:', error));
}

httpServer.listen(PORT, process.env.HOST || undefined, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO ready for connections`);
  syncProductionIndex()
    .then((count) => console.log(`Search index ready (${count} productions)`))
    .catch((error) => console.warn("Search index unavailable; database fallback is active:", error.message));
});
