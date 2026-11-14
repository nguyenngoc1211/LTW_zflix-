import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "../../core/database/pool.js";
import { fromMongo, mongoCollection, nextNumericId, withMongoTransaction } from "../../core/database/mongo.js";
import { requireAuth, optionalAuth } from "../../core/middleware/business-auth.bridge.js";
import { canAccessPremium } from "../../core/security/entitlements.js";
import { asyncHandler, parsePositiveInt } from "../../core/utils/http.js";
import {
  applyEpisodeAccess,
  resolveProductionPremium,
} from "../streaming/playback-access.js";
import {
  emitWatchPartyLeave,
  leaveWatchParty,
} from "./watch-party.membership.js";

export const watchPartyRouter = Router();
const useMongo = () => process.env.DATA_STORE === "mongodb";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const generatePartyId = () => crypto.randomBytes(4).toString("hex").toUpperCase();

const ensureEpisode = async (episodeId) => {
  if (useMongo()) {
    const episode = await (await mongoCollection("episodes")).findOne({ id: episodeId });
    if (episode) return fromMongo(episode);
    const error = new Error("Episode not found"); error.status = 404; throw error;
  }
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

const mongoPartyRows = async (partyIds) => {
  const [parties, productions, episodes, users, participants] = await Promise.all([
    (await mongoCollection("watch_parties")).find({ id: { $in: partyIds } }).toArray(),
    (await mongoCollection("productions")).find({}).toArray(),
    (await mongoCollection("episodes")).find({}).toArray(),
    (await mongoCollection("users")).find({}).toArray(),
    (await mongoCollection("watch_party_participants")).find({ party_id: { $in: partyIds } }).toArray(),
  ]);
  const productionById = new Map(productions.map((row) => [row.id, row]));
  const episodeById = new Map(episodes.map((row) => [row.id, row]));
  const userById = new Map(users.map((row) => [row.id, row]));
  return parties.flatMap((party) => {
    const production = productionById.get(party.production_id);
    const episode = episodeById.get(party.episode_id);
    const host = userById.get(party.host_id);
    return production && episode && host ? [{ ...fromMongo(party),
      production_title: production.title, poster_url: production.poster_url,
      banner_url: production.banner_url, episode_title: episode.title,
      video_url: episode.video_url, duration: episode.duration,
      thumbnail_url: episode.thumbnail_url, host_name: host.username,
      host_avatar: host.avatar_url, has_password: Number(Boolean(party.password)),
      participant_count: participants.filter((item) => item.party_id === party.id).length }]
      : [];
  });
};

const insertSystemChat = async (partyId, userId, message, session) => {
  const id = await nextNumericId("watch_party_chats");
  await (await mongoCollection("watch_party_chats")).insertOne({ _id: id, id,
    party_id: partyId, user_id: userId, message, timestamp_in_video: 0,
    is_system_message: 1, created_at: new Date() }, session ? { session } : undefined);
};

// ---------------------------------------------------------------------------
// GET /watch-party-episodes – Danh sách phim & tập có sẵn để tạo phòng
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party-episodes",
  asyncHandler(async (req, res) => {
    if (useMongo()) {
      const [episodes, productions] = await Promise.all([
        (await mongoCollection("episodes")).find({}).toArray(),
        (await mongoCollection("productions")).find({}).toArray(),
      ]);
      const productionById = new Map(productions.map((row) => [row.id, row]));
      const items = episodes.flatMap((episode) => {
        const production = productionById.get(episode.production_id);
        return production ? [{ id: episode.id, episode_title: episode.title,
          episode_number: episode.episode_number, duration: episode.duration,
          thumbnail_url: episode.thumbnail_url, production_id: production.id,
          production_title: production.title, poster_url: production.poster_url }] : [];
      }).sort((a, b) => a.production_title.localeCompare(b.production_title)
        || a.episode_number - b.episode_number).slice(0, 100);
      return res.json({ items });
    }
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
    if (useMongo()) {
      const items = await (await mongoCollection("users")).find({},
        { projection: { id: 1, username: 1, email: 1, avatar_url: 1, role: 1 } }).limit(10).toArray();
      return res.json({ items: items.map(fromMongo) });
    }
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
    if (useMongo()) {
      const parties = await (await mongoCollection("watch_parties"))
        .find({ status: { $in: ["waiting", "playing", "paused"] } })
        .sort({ created_at: -1 }).toArray();
      const rows = await mongoPartyRows(parties.map((party) => party.id));
      const items = rows.filter((row) => !search || row.title.toLowerCase().includes(search.toLowerCase())
        || row.production_title.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50)
        .map(({ password, video_url, duration, banner_url, ...row }) => row);
      return res.json({ items });
    }
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
    const { title, episodeId, password, maxParticipants } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "title is required" });
    }
    const epId = parsePositiveInt(episodeId, "episodeId");
    const episode = await ensureEpisode(epId);
    const premium = await resolveProductionPremium(episode.production_id);
    if (premium && !canAccessPremium(req.user)) {
      return res.status(403).json({ message: "VIP membership is required for this episode", code: "VIP_REQUIRED" });
    }

    const partyId = generatePartyId();
    const maxP = Math.min(50, Math.max(2, Number(maxParticipants) || 10));
    const pwd = typeof password === "string" && password.trim() ? password.trim() : null;

    if (useMongo()) {
      await withMongoTransaction(async (session) => {
        const now = new Date();
        await (await mongoCollection("watch_parties")).insertOne({ _id: partyId,
          id: partyId, host_id: req.user.id, title: title.trim().slice(0, 255),
          password: pwd, max_participants: maxP, production_id: episode.production_id,
          episode_id: epId, current_position: 0, is_playing: 0, allow_chat: 1,
          allow_skip_votes: 0, skip_votes_required: 3, status: "waiting",
          created_at: now, started_at: null,
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, { session });
        await (await mongoCollection("watch_party_participants")).insertOne({
          _id: { party_id: partyId, user_id: req.user.id }, party_id: partyId,
          user_id: req.user.id, role: "host", can_control_playback: 1,
          can_send_chat: 1, is_muted: 0, joined_at: now, last_active_at: now,
        }, { session });
      });
      return res.status(201).json({ partyId, title: title.trim() });
    }

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
// GET /watch-party/my-parties  –  Phòng mà user đang tham gia
// Đăng ký TRƯỚC route động :partyId để không bị route đó bắt nhầm.
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party/my-parties",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (useMongo()) {
      const participants = await (await mongoCollection("watch_party_participants"))
        .find({ user_id: req.user.id }).toArray();
      const rows = await mongoPartyRows(participants.map((part) => part.party_id));
      const roleByParty = new Map(participants.map((part) => [part.party_id, part.role]));
      const items = rows.filter((row) => row.status !== "ended")
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map((row) => ({ id: row.id, title: row.title, status: row.status,
          created_at: row.created_at, production_title: row.production_title,
          poster_url: row.poster_url, episode_title: row.episode_title,
          host_name: row.host_name, role: roleByParty.get(row.id),
          participant_count: row.participant_count }));
      return res.json({ items });
    }
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

// ---------------------------------------------------------------------------
// GET /watch-party/:partyId  –  Chi tiết phòng
// ---------------------------------------------------------------------------
watchPartyRouter.get(
  "/watch-party/:partyId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    if (useMongo()) {
      const rows = await mongoPartyRows([partyId]);
      if (!rows.length) return res.status(404).json({ message: "Party not found" });
      const party = rows[0];
      const premium = await resolveProductionPremium(party.production_id);
      Object.assign(party, applyEpisodeAccess({ video_url: party.video_url },
        { premium, user: req.user }));
      delete party.password;
      const [parts, chatRows, users] = await Promise.all([
        (await mongoCollection("watch_party_participants")).find({ party_id: partyId }).toArray(),
        (await mongoCollection("watch_party_chats")).find({ party_id: partyId })
          .sort({ created_at: -1 }).limit(100).toArray(),
        (await mongoCollection("users")).find({}).toArray(),
      ]);
      const userById = new Map(users.map((user) => [user.id, user]));
      const participants = parts.flatMap((part) => {
        const user = userById.get(part.user_id);
        return user ? [{ user_id: part.user_id, role: part.role,
          can_control_playback: part.can_control_playback,
          can_send_chat: part.can_send_chat, is_muted: part.is_muted,
          joined_at: part.joined_at, username: user.username,
          avatar_url: user.avatar_url }] : [];
      }).sort((a, b) => (b.role === "host") - (a.role === "host")
        || (b.role === "co-host") - (a.role === "co-host")
        || new Date(a.joined_at) - new Date(b.joined_at));
      const chats = chatRows.flatMap((chat) => {
        const user = userById.get(chat.user_id);
        return user ? [{ id: chat.id, user_id: chat.user_id, message: chat.message,
          timestamp_in_video: chat.timestamp_in_video,
          is_system_message: chat.is_system_message, created_at: chat.created_at,
          username: user.username, avatar_url: user.avatar_url }] : [];
      }).reverse();
      return res.json({ party, participants, chats });
    }
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
    const premium = await resolveProductionPremium(party.production_id);
    Object.assign(
      party,
      applyEpisodeAccess(
        { video_url: party.video_url },
        { premium, user: req.user },
      ),
    );
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
    const { password } = req.body || {};

    if (useMongo()) {
      const party = await (await mongoCollection("watch_parties")).findOne({ id: partyId });
      if (!party) return res.status(404).json({ message: "Party not found" });
      if (party.status === "ended") return res.status(400).json({ message: "Party has ended" });
      if (party.password && party.password !== password) {
        return res.status(403).json({ message: "Wrong password" });
      }
      if (await resolveProductionPremium(party.production_id) && !canAccessPremium(req.user)) {
        return res.status(403).json({ message: "VIP membership is required for this party", code: "VIP_REQUIRED" });
      }
      const participants = await mongoCollection("watch_party_participants");
      if (await participants.countDocuments({ party_id: partyId }) >= party.max_participants) {
        return res.status(400).json({ message: "Party is full" });
      }
      await participants.updateOne({ party_id: partyId, user_id: req.user.id },
        { $set: { joined_at: new Date() },
          $setOnInsert: { _id: { party_id: partyId, user_id: req.user.id },
            party_id: partyId, user_id: req.user.id, role: "participant",
            can_control_playback: 0, can_send_chat: 1, is_muted: 0,
            last_active_at: new Date() } }, { upsert: true });
      await insertSystemChat(partyId, req.user.id, `${req.user.username} đã tham gia phòng.`);
      return res.json({ joined: true, partyId });
    }

    const [parties] = await pool.execute(
      "SELECT id, password, max_participants, status, production_id FROM watch_parties WHERE id = ? LIMIT 1",
      [partyId],
    );
    if (!parties.length) return res.status(404).json({ message: "Party not found" });

    const party = parties[0];
    if (party.status === "ended") return res.status(400).json({ message: "Party has ended" });
    if (party.password && party.password !== password) {
      return res.status(403).json({ message: "Wrong password" });
    }
    if (
      (await resolveProductionPremium(party.production_id)) &&
      !canAccessPremium(req.user)
    ) {
      return res.status(403).json({ message: "VIP membership is required for this party", code: "VIP_REQUIRED" });
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
    const result = await leaveWatchParty({
      partyId,
      userId: req.user.id,
      username: req.user.username,
    });

    const namespace = req.app.get("watchPartyNamespace");
    if (namespace) {
      const sockets = await namespace.in(partyId).fetchSockets();
      for (const socket of sockets) {
        if (Number(socket.data.userId) !== Number(req.user.id)) continue;
        await socket.leave(partyId);
        socket.data.partyId = null;
        namespace.to(partyId).emit("media-peer-left", {
          peerId: socket.id,
          userId: req.user.id,
        });
      }
    }
    emitWatchPartyLeave(namespace, result);
    res.json({
      left: true,
      alreadyLeft: Boolean(result.alreadyLeft),
      ended: Boolean(result.ended),
      newHost: result.newHost || null,
    });
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
    const { status } = req.body || {};

    const allowed = ["waiting", "playing", "paused", "ended"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    if (useMongo()) {
      const part = await (await mongoCollection("watch_party_participants"))
        .findOne({ party_id: partyId, user_id: req.user.id });
      if (!part || !["host", "co-host"].includes(part.role)) {
        return res.status(403).json({ message: "Only host/co-host can change status" });
      }
      await (await mongoCollection("watch_parties")).updateOne({ id: partyId },
        { $set: { status } });
      return res.json({ status });
    }

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
    const { currentPosition, isPlaying } = req.body || {};

    if (useMongo()) {
      const part = await (await mongoCollection("watch_party_participants"))
        .findOne({ party_id: partyId, user_id: req.user.id });
      if (!part || (!["host", "co-host"].includes(part.role) && !part.can_control_playback)) {
        return res.status(403).json({ message: "No playback control permission" });
      }
      const updates = {};
      if (currentPosition !== undefined) updates.current_position = Math.max(0, Number(currentPosition) || 0);
      if (isPlaying !== undefined) {
        updates.is_playing = isPlaying ? 1 : 0;
        updates.status = isPlaying ? "playing" : "paused";
      }
      if (!Object.keys(updates).length) return res.status(400).json({ message: "Nothing to update" });
      await (await mongoCollection("watch_parties")).updateOne({ id: partyId }, { $set: updates });
      return res.json({ updated: true });
    }

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
    const content = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!content || content.length > 1000) {
      return res.status(400).json({ message: "Message is required and must not exceed 1000 characters" });
    }

    if (useMongo()) {
      const part = await (await mongoCollection("watch_party_participants"))
        .findOne({ party_id: partyId, user_id: req.user.id });
      if (!part) return res.status(403).json({ message: "Not in this party" });
      if (!part.can_send_chat || part.is_muted) {
        return res.status(403).json({ message: "You are muted or chat is disabled" });
      }
      const party = await (await mongoCollection("watch_parties")).findOne({ id: partyId });
      if (!party || party.status === "ended") return res.status(400).json({ message: "Party has ended" });
      if (!party.allow_chat) return res.status(403).json({ message: "Chat is disabled in this party" });
      const timestampInVideo = Number(req.body?.timestampInVideo) || 0;
      const id = await nextNumericId("watch_party_chats");
      await (await mongoCollection("watch_party_chats")).insertOne({ _id: id, id,
        party_id: partyId, user_id: req.user.id, message: content,
        timestamp_in_video: timestampInVideo, is_system_message: 0,
        created_at: new Date() });
      return res.status(201).json({ id, message: content, timestampInVideo,
        userId: req.user.id, username: req.user.username });
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

    const timestampInVideo = Number(req.body?.timestampInVideo) || 0;

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

    if (useMongo()) {
      const participants = await mongoCollection("watch_party_participants");
      const host = await participants.findOne({ party_id: partyId, user_id: req.user.id });
      if (!host || host.role !== "host") {
        return res.status(403).json({ message: "Only host can manage participants" });
      }
      const { action } = req.body || {};
      const filter = { party_id: partyId, user_id: targetUserId };
      switch (action) {
        case "mute": await participants.updateOne(filter, { $set: { is_muted: 1 } }); break;
        case "unmute": await participants.updateOne(filter, { $set: { is_muted: 0 } }); break;
        case "promote": await participants.updateOne(filter,
          { $set: { role: "co-host", can_control_playback: 1 } }); break;
        case "demote": await participants.updateOne(filter,
          { $set: { role: "participant", can_control_playback: 0 } }); break;
        case "kick": {
          await participants.deleteOne(filter);
          const user = await (await mongoCollection("users")).findOne({ id: targetUserId });
          await insertSystemChat(partyId, req.user.id,
            `${user?.username || `User#${targetUserId}`} đã bị kick khỏi phòng.`);
          break;
        }
        default: return res.status(400).json({ message: "Invalid action: mute|unmute|promote|demote|kick" });
      }
      return res.json({ success: true, action });
    }

    // Kiểm tra quyền host
    const [hostParts] = await pool.execute(
      "SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, req.user.id],
    );
    if (!hostParts.length || hostParts[0].role !== "host") {
      return res.status(403).json({ message: "Only host can manage participants" });
    }

    const { action } = req.body || {};

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

    if (useMongo()) {
      const part = await (await mongoCollection("watch_party_participants"))
        .findOne({ party_id: partyId, user_id: req.user.id });
      if (!part || part.role !== "host") {
        return res.status(403).json({ message: "Only host can change settings" });
      }
      const updates = {};
      if (req.body.allowChat !== undefined) updates.allow_chat = req.body.allowChat ? 1 : 0;
      if (req.body.title !== undefined) updates.title = String(req.body.title).trim().slice(0, 255);
      if (req.body.maxParticipants !== undefined) {
        updates.max_participants = Math.min(50, Math.max(2, Number(req.body.maxParticipants) || 10));
      }
      if (!Object.keys(updates).length) return res.status(400).json({ message: "Nothing to update" });
      await (await mongoCollection("watch_parties")).updateOne({ id: partyId }, { $set: updates });
      return res.json({ updated: true });
    }

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
