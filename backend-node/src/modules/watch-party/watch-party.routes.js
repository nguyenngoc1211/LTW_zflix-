import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "../../core/database/pool.js";
import { requireAuth } from "../../core/middleware/business-auth.bridge.js";
import { asyncHandler, parsePositiveInt } from "../../core/utils/http.js";

export const watchPartyRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const generatePartyId = () => crypto.randomBytes(4).toString("hex").toUpperCase();

const ensureEpisode = async (episodeId) => {
  const [rows] = await pool.execute(
    "SELECT e.id, e.production_id, e.title, e.video_url, e.duration, e.thumbnail_url FROM episodes e WHERE e.id = ? LIMIT 1",
    [episodeId],
  );
  if (!rows.length) {
    const error = new Error("Episode not found");
    error.status = 404;
    throw error;
  }
  return rows[0];
};

// ---------------------------------------------------------------------------
// GET /watch-party-episodes – Danh sách phim & tập có sẵn để tạo phòng
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party-episodes",
  asyncHandler(async (req, res) => {
    const [items] = await pool.execute(`
      SELECT e.id, e.title AS episode_title, e.episode_number, e.duration, e.thumbnail_url,
             p.id AS production_id, p.title AS production_title, p.poster_url
      FROM episodes e
      JOIN productions p ON p.id = e.production_id
      ORDER BY p.title ASC, e.episode_number ASC
      LIMIT 100
    `);
    res.json({ items });
  })
);

// ---------------------------------------------------------------------------
// GET /watch-party-users – Danh sách người dùng mẫu để chuyển đổi khi test
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party-users",
  asyncHandler(async (req, res) => {
    const [items] = await pool.execute(
      "SELECT id, username, email, avatar_url, role FROM users LIMIT 10"
    );
    res.json({ items });
  })
);

// ---------------------------------------------------------------------------
// GET /watch-party  –  Danh sách phòng đang hoạt động
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    let sql = `
      SELECT wp.id, wp.title, wp.max_participants, wp.status, wp.created_at,
             wp.password IS NOT NULL AS has_password,
             p.title  AS production_title,
             p.poster_url,
             e.title  AS episode_title,
             u.username AS host_name,
             u.avatar_url AS host_avatar,
             (SELECT COUNT(*) FROM watch_party_participants wpp WHERE wpp.party_id = wp.id) AS participant_count
      FROM watch_parties wp
      JOIN productions p ON p.id = wp.production_id
      JOIN episodes e ON e.id = wp.episode_id
      JOIN users u ON u.id = wp.host_id
      WHERE wp.status IN ('waiting', 'playing', 'paused')
    `;
    const params = [];
    if (search) {
      sql += " AND (wp.title LIKE ? OR p.title LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += " ORDER BY wp.created_at DESC LIMIT 50";
    const [items] = await pool.execute(sql, params);
    res.json({ items });
  }),
);

// ---------------------------------------------------------------------------
// POST /watch-party  –  Tạo phòng mới
// ---------------------------------------------------------------------------
watchPartyRouter.post(
  "/watch-party",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { title, episodeId, password, maxParticipants } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "title is required" });
    }
    const epId = parsePositiveInt(episodeId, "episodeId");
    const episode = await ensureEpisode(epId);

    const partyId = generatePartyId();
    const maxP = Math.min(50, Math.max(2, Number(maxParticipants) || 10));
    const pwd = typeof password === "string" && password.trim() ? password.trim() : null;

    await pool.execute(
      `INSERT INTO watch_parties (id, host_id, title, password, max_participants, production_id, episode_id, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR))`,
      [partyId, req.user.id, title.trim().slice(0, 255), pwd, maxP, episode.production_id, epId],
    );

    // Host tự động tham gia
    await pool.execute(
      `INSERT INTO watch_party_participants (party_id, user_id, role, can_control_playback, can_send_chat)
       VALUES (?, ?, 'host', 1, 1)`,
      [partyId, req.user.id],
    );

    res.status(201).json({ partyId, title: title.trim() });
  }),
);

// ---------------------------------------------------------------------------
// GET /watch-party/:partyId  –  Chi tiết phòng
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party/:partyId",
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const [parties] = await pool.execute(
      `SELECT wp.*,
              p.title AS production_title, p.poster_url, p.banner_url,
              e.title AS episode_title, e.video_url, e.duration, e.thumbnail_url,
              u.username AS host_name, u.avatar_url AS host_avatar
       FROM watch_parties wp
       JOIN productions p ON p.id = wp.production_id
       JOIN episodes e ON e.id = wp.episode_id
       JOIN users u ON u.id = wp.host_id
       WHERE wp.id = ? LIMIT 1`,
      [partyId],
    );
    if (!parties.length) return res.status(404).json({ message: "Party not found" });

    const party = parties[0];
    delete party.password; // Không trả password về client

    // Lấy danh sách participants
    const [participants] = await pool.execute(
      `SELECT wpp.user_id, wpp.role, wpp.can_control_playback, wpp.can_send_chat, wpp.is_muted,
              wpp.joined_at, u.username, u.avatar_url
       FROM watch_party_participants wpp
       JOIN users u ON u.id = wpp.user_id
       WHERE wpp.party_id = ?
       ORDER BY wpp.role = 'host' DESC, wpp.role = 'co-host' DESC, wpp.joined_at ASC`,
      [partyId],
    );

    // Lấy chat messages gần nhất
    const [chats] = await pool.execute(
      `SELECT c.id, c.user_id, c.message, c.timestamp_in_video, c.is_system_message, c.created_at,
              u.username, u.avatar_url
       FROM watch_party_chats c
       JOIN users u ON u.id = c.user_id
       WHERE c.party_id = ?
       ORDER BY c.created_at DESC LIMIT 100`,
      [partyId],
    );

    res.json({ party, participants, chats: chats.reverse() });
  }),
);

// ---------------------------------------------------------------------------
// POST /watch-party/:partyId/join  –  Tham gia phòng
// ---------------------------------------------------------------------------
watchPartyRouter.post(
  "/watch-party/:partyId/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const { password } = req.body;

    const [parties] = await pool.execute(
      "SELECT id, password, max_participants, status FROM watch_parties WHERE id = ? LIMIT 1",
      [partyId],
    );
    if (!parties.length) return res.status(404).json({ message: "Party not found" });

    const party = parties[0];
    if (party.status === "ended") return res.status(400).json({ message: "Party has ended" });
    if (party.password && party.password !== password) {
      return res.status(403).json({ message: "Wrong password" });
    }

    // Kiểm tra số người tham gia
    const [countRows] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM watch_party_participants WHERE party_id = ?",
      [partyId],
    );
    if (countRows[0].cnt >= party.max_participants) {
      return res.status(400).json({ message: "Party is full" });
    }

    // Thêm participant (ON DUPLICATE KEY: đã tham gia rồi thì bỏ qua)
    await pool.execute(
      `INSERT INTO watch_party_participants (party_id, user_id, role, can_control_playback, can_send_chat)
       VALUES (?, ?, 'participant', 0, 1)
       ON DUPLICATE KEY UPDATE joined_at = CURRENT_TIMESTAMP`,
      [partyId, req.user.id],
    );

    // Tin nhắn hệ thống
    await pool.execute(
      `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
       VALUES (?, ?, ?, 1)`,
      [partyId, req.user.id, `${req.user.username} đã tham gia phòng.`],
    );

    res.json({ joined: true, partyId });
  }),
);

// ---------------------------------------------------------------------------
// POST /watch-party/:partyId/leave  –  Rời phòng
// ---------------------------------------------------------------------------
watchPartyRouter.post(
  "/watch-party/:partyId/leave",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;

    // Kiểm tra nếu là host thì kết thúc phòng luôn
    const [parts] = await pool.execute(
      "SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, req.user.id],
    );
    if (!parts.length) return res.status(400).json({ message: "Not in this party" });

    if (parts[0].role === "host") {
      // Host rời = kết thúc phòng
      await pool.execute("UPDATE watch_parties SET status = 'ended' WHERE id = ?", [partyId]);
      await pool.execute(
        `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
         VALUES (?, ?, ?, 1)`,
        [partyId, req.user.id, "Host đã kết thúc phòng xem."],
      );
    } else {
      await pool.execute(
        "DELETE FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
        [partyId, req.user.id],
      );
      await pool.execute(
        `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
         VALUES (?, ?, ?, 1)`,
        [partyId, req.user.id, `${req.user.username} đã rời phòng.`],
      );
    }

    res.json({ left: true });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /watch-party/:partyId/status  –  Cập nhật trạng thái phòng (host only)
// ---------------------------------------------------------------------------
watchPartyRouter.patch(
  "/watch-party/:partyId/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const { status } = req.body;

    const allowed = ["waiting", "playing", "paused", "ended"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    // Kiểm tra quyền host
    const [parts] = await pool.execute(
      "SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, req.user.id],
    );
    if (!parts.length || !["host", "co-host"].includes(parts[0].role)) {
      return res.status(403).json({ message: "Only host/co-host can change status" });
    }

    await pool.execute("UPDATE watch_parties SET status = ? WHERE id = ?", [status, partyId]);
    res.json({ status });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /watch-party/:partyId/playback  –  Đồng bộ playback (host/co-host)
// ---------------------------------------------------------------------------
watchPartyRouter.patch(
  "/watch-party/:partyId/playback",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const { currentPosition, isPlaying } = req.body;

    const [parts] = await pool.execute(
      "SELECT role, can_control_playback FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, req.user.id],
    );
    if (!parts.length || (!["host", "co-host"].includes(parts[0].role) && !parts[0].can_control_playback)) {
      return res.status(403).json({ message: "No playback control permission" });
    }

    const updates = [];
    const params = [];
    if (currentPosition !== undefined) {
      updates.push("current_position = ?");
      params.push(Math.max(0, Number(currentPosition) || 0));
    }
    if (isPlaying !== undefined) {
      updates.push("is_playing = ?");
      params.push(isPlaying ? 1 : 0);
      updates.push("status = ?");
      params.push(isPlaying ? "playing" : "paused");
    }
    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });

    params.push(partyId);
    await pool.execute(`UPDATE watch_parties SET ${updates.join(", ")} WHERE id = ?`, params);
    res.json({ updated: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /watch-party/:partyId/chat  –  Gửi tin nhắn chat
// ---------------------------------------------------------------------------
watchPartyRouter.post(
  "/watch-party/:partyId/chat",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const content = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!content || content.length > 1000) {
      return res.status(400).json({ message: "Message is required and must not exceed 1000 characters" });
    }

    // Kiểm tra quyền chat
    const [parts] = await pool.execute(
      "SELECT can_send_chat, is_muted FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, req.user.id],
    );
    if (!parts.length) return res.status(403).json({ message: "Not in this party" });
    if (!parts[0].can_send_chat || parts[0].is_muted) {
      return res.status(403).json({ message: "You are muted or chat is disabled" });
    }

    // Kiểm tra phòng còn cho phép chat
    const [partyRows] = await pool.execute(
      "SELECT allow_chat, status FROM watch_parties WHERE id = ?",
      [partyId],
    );
    if (!partyRows.length || partyRows[0].status === "ended") {
      return res.status(400).json({ message: "Party has ended" });
    }
    if (!partyRows[0].allow_chat) {
      return res.status(403).json({ message: "Chat is disabled in this party" });
    }

    const timestampInVideo = Number(req.body.timestampInVideo) || 0;

    const [result] = await pool.execute(
      `INSERT INTO watch_party_chats (party_id, user_id, message, timestamp_in_video, is_system_message)
       VALUES (?, ?, ?, ?, 0)`,
      [partyId, req.user.id, content, timestampInVideo],
    );

    res.status(201).json({
      id: result.insertId,
      message: content,
      timestampInVideo,
      userId: req.user.id,
      username: req.user.username,
    });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /watch-party/:partyId/participants/:userId  –  Quản lý thành viên (host)
// ---------------------------------------------------------------------------
watchPartyRouter.patch(
  "/watch-party/:partyId/participants/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const targetUserId = parsePositiveInt(req.params.userId, "userId");

    // Kiểm tra quyền host
    const [hostParts] = await pool.execute(
      "SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, req.user.id],
    );
    if (!hostParts.length || hostParts[0].role !== "host") {
      return res.status(403).json({ message: "Only host can manage participants" });
    }

    const { action } = req.body;

    switch (action) {
      case "mute": {
        await pool.execute(
          "UPDATE watch_party_participants SET is_muted = 1 WHERE party_id = ? AND user_id = ?",
          [partyId, targetUserId],
        );
        break;
      }
      case "unmute": {
        await pool.execute(
          "UPDATE watch_party_participants SET is_muted = 0 WHERE party_id = ? AND user_id = ?",
          [partyId, targetUserId],
        );
        break;
      }
      case "promote": {
        await pool.execute(
          "UPDATE watch_party_participants SET role = 'co-host', can_control_playback = 1 WHERE party_id = ? AND user_id = ?",
          [partyId, targetUserId],
        );
        break;
      }
      case "demote": {
        await pool.execute(
          "UPDATE watch_party_participants SET role = 'participant', can_control_playback = 0 WHERE party_id = ? AND user_id = ?",
          [partyId, targetUserId],
        );
        break;
      }
      case "kick": {
        await pool.execute(
          "DELETE FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
          [partyId, targetUserId],
        );
        // Lấy username để gửi tin nhắn hệ thống
        const [users] = await pool.execute("SELECT username FROM users WHERE id = ?", [targetUserId]);
        const uname = users.length ? users[0].username : `User#${targetUserId}`;
        await pool.execute(
          `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
           VALUES (?, ?, ?, 1)`,
          [partyId, req.user.id, `${uname} đã bị kick khỏi phòng.`],
        );
        break;
      }
      default:
        return res.status(400).json({ message: "Invalid action: mute|unmute|promote|demote|kick" });
    }

    res.json({ success: true, action });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /watch-party/:partyId/settings  –  Cập nhật cài đặt phòng (host)
// ---------------------------------------------------------------------------
watchPartyRouter.patch(
  "/watch-party/:partyId/settings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;

    const [hostParts] = await pool.execute(
      "SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, req.user.id],
    );
    if (!hostParts.length || hostParts[0].role !== "host") {
      return res.status(403).json({ message: "Only host can change settings" });
    }

    const updates = [];
    const params = [];

    if (req.body.allowChat !== undefined) {
      updates.push("allow_chat = ?");
      params.push(req.body.allowChat ? 1 : 0);
    }
    if (req.body.title !== undefined) {
      updates.push("title = ?");
      params.push(String(req.body.title).trim().slice(0, 255));
    }
    if (req.body.maxParticipants !== undefined) {
      updates.push("max_participants = ?");
      params.push(Math.min(50, Math.max(2, Number(req.body.maxParticipants) || 10)));
    }

    if (!updates.length) return res.status(400).json({ message: "Nothing to update" });

    params.push(partyId);
    await pool.execute(`UPDATE watch_parties SET ${updates.join(", ")} WHERE id = ?`, params);
    res.json({ updated: true });
  }),
);

// ---------------------------------------------------------------------------
// GET /watch-party/my-parties  –  Phòng mà user đang tham gia
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party/my-parties",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [items] = await pool.execute(
      `SELECT wp.id, wp.title, wp.status, wp.created_at,
              p.title AS production_title, p.poster_url,
              e.title AS episode_title,
              u.username AS host_name,
              wpp.role,
              (SELECT COUNT(*) FROM watch_party_participants p2 WHERE p2.party_id = wp.id) AS participant_count
       FROM watch_party_participants wpp
       JOIN watch_parties wp ON wp.id = wpp.party_id
       JOIN productions p ON p.id = wp.production_id
       JOIN episodes e ON e.id = wp.episode_id
       JOIN users u ON u.id = wp.host_id
       WHERE wpp.user_id = ? AND wp.status != 'ended'
       ORDER BY wp.created_at DESC`,
      [req.user.id],
    );
    res.json({ items });
  }),
);
