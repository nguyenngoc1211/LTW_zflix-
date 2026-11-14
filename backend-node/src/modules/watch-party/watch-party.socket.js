import jwt from "jsonwebtoken";
import { securityConfig } from "../../config/security.config.js";
import { pool } from "../../core/database/pool.js";
import { mongoCollection, nextNumericId } from "../../core/database/mongo.js";
import {
  emitWatchPartyLeave,
  leaveWatchParty,
} from "./watch-party.membership.js";

const useMongo = () => process.env.DATA_STORE === "mongodb";
const mongoParticipant = async (partyId, userId) =>
  (await mongoCollection("watch_party_participants")).findOne({ party_id: partyId, user_id: userId });
const mongoParty = async (partyId) =>
  (await mongoCollection("watch_parties")).findOne({ id: partyId });
const insertMongoChat = async (partyId, userId, message, timestamp = 0, system = false) => {
  const id = await nextNumericId("watch_party_chats");
  const createdAt = new Date();
  await (await mongoCollection("watch_party_chats")).insertOne({ _id: id, id,
    party_id: partyId, user_id: userId, message,
    timestamp_in_video: timestamp, is_system_message: Number(system), created_at: createdAt });
  return { id, createdAt };
};

/**
 * Watch Party Socket.IO handler
 *
 * Events (Client → Server):
 *   join-party       { partyId }
 *   leave-party      { partyId }
 *   chat-message     { partyId, message, timestampInVideo }
 *   sync-playback    { partyId, currentPosition, isPlaying }
 *   request-sync     { partyId }
 *   webrtc-offer     { partyId, to, description }
 *   webrtc-answer    { partyId, to, description }
 *   webrtc-ice-candidate { partyId, to, candidate }
 *   media-state      { partyId, audioEnabled, videoEnabled }
 *
 * Events (Server → Client):
 *   party-joined     { userId, username, avatarUrl, role }
 *   party-left       { userId, username }
 *   new-chat         { id, userId, username, avatarUrl, message, timestampInVideo, isSystemMessage, createdAt }
 *   playback-sync    { currentPosition, isPlaying, updatedBy }
 *   party-ended      { partyId }
 *   participant-updated { userId, action, ... }
 *   host-changed     { previousHostId, newHostId, newHostName }
 *   media-peers / media-peer-joined / media-peer-left
 *   error            { message }
 */

// Xác thực socket bằng access token (JWT + session trong DB). Danh tính lấy từ
// server, không tin userId/username do client gửi kèm sự kiện.
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    const payload = jwt.verify(token, securityConfig.jwtAccessSecret, {
      algorithms: securityConfig.jwtAlgorithms,
    });
    if (useMongo()) {
      const userId = Number(payload.sub);
      const session = await (await mongoCollection("auth_sessions")).findOne({
        id: payload.sid, user_id: userId, revoked_at: null,
        expires_at: { $gt: new Date() }, absolute_expires_at: { $gt: new Date() },
      });
      const user = session ? await (await mongoCollection("users"))
        .findOne({ id: userId, status: "active" }) : null;
      if (!user) return next(new Error("Session is invalid or expired"));
      socket.data.sessionId = session.id;
      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.avatarUrl = user.avatar_url;
      return next();
    }
    const [rows] = await pool.execute(
      `SELECT s.id AS session_id, u.id AS user_id, u.username, u.avatar_url
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
    if (!rows.length) return next(new Error("Session is invalid or expired"));

    socket.data.sessionId = rows[0].session_id;
    socket.data.userId = rows[0].user_id;
    socket.data.username = rows[0].username;
    socket.data.avatarUrl = rows[0].avatar_url;
    return next();
  } catch {
    return next(new Error("Authentication required"));
  }
};

export const registerWatchPartySocket = (io) => {
  const partyNamespace = io.of("/watch-party");
  const pendingDisconnects = new Map();
  const disconnectGraceMs = 5000;

  const membershipKey = (partyId, userId) => `${partyId}:${userId}`;

  const cancelPendingDisconnect = (partyId, userId) => {
    const key = membershipKey(partyId, userId);
    const timer = pendingDisconnects.get(key);
    if (timer) clearTimeout(timer);
    pendingDisconnects.delete(key);
  };

  const peerDetails = (peer) => ({
    peerId: peer.id,
    userId: peer.data.userId,
    username: peer.data.username,
    avatarUrl: peer.data.avatarUrl,
    audioEnabled: Boolean(peer.data.mediaState?.audioEnabled),
    videoEnabled: Boolean(peer.data.mediaState?.videoEnabled),
  });

  const isJoinedSocket = (socket, partyId) => (
    Boolean(partyId)
    && socket.data.partyId === partyId
    && socket.rooms.has(partyId)
  );

  const consumeSignalBudget = (socket) => {
    const now = Date.now();
    const current = socket.data.webRtcSignalBudget || { startedAt: now, count: 0 };
    if (now - current.startedAt >= 10_000) {
      current.startedAt = now;
      current.count = 0;
    }
    current.count += 1;
    socket.data.webRtcSignalBudget = current;
    return current.count <= 200;
  };

  const relayWebRtcSignal = (socket, eventName, payload = {}) => {
    const { partyId, to } = payload;
    const isDescription = eventName === "webrtc-offer" || eventName === "webrtc-answer";
    const validDescription = !isDescription || (
      payload.description?.type === (eventName === "webrtc-offer" ? "offer" : "answer")
      && typeof payload.description?.sdp === "string"
      && payload.description.sdp.length <= 200_000
    );
    const validCandidate = eventName !== "webrtc-ice-candidate" || (
      typeof payload.candidate?.candidate === "string"
      && payload.candidate.candidate.length <= 8_192
    );
    if (!consumeSignalBudget(socket) || !validDescription || !validCandidate
        || !isJoinedSocket(socket, partyId) || typeof to !== "string" || to === socket.id) {
      return socket.emit("error", { message: "Invalid WebRTC signal" });
    }

    const target = partyNamespace.sockets.get(to);
    if (!target || !isJoinedSocket(target, partyId)) {
      return socket.emit("media-peer-left", { peerId: to });
    }

    target.emit(eventName, {
      from: socket.id,
      userId: socket.data.userId,
      username: socket.data.username,
      description: payload.description,
      candidate: payload.candidate,
    });
  };

  const finishMembershipLeave = async ({ partyId, userId, username, peerId }) => {
    try {
      const result = await leaveWatchParty({ partyId, userId, username });
      emitWatchPartyLeave(partyNamespace, result, peerId);
    } catch (error) {
      console.error("[WatchParty] leave error:", error);
    }
  };

  const scheduleDisconnectLeave = ({ partyId, userId, username, peerId }) => {
    const key = membershipKey(partyId, userId);
    cancelPendingDisconnect(partyId, userId);
    const timer = setTimeout(async () => {
      pendingDisconnects.delete(key);
      const roomSockets = await partyNamespace.in(partyId).fetchSockets();
      if (roomSockets.some((peer) => peer.data.userId === userId)) {
        partyNamespace.to(partyId).emit("media-peer-left", { peerId, userId });
        return;
      }
      await finishMembershipLeave({ partyId, userId, username, peerId });
    }, disconnectGraceMs);
    pendingDisconnects.set(key, timer);
  };

  partyNamespace.use(authenticateSocket);

  partyNamespace.on("connection", (socket) => {
    console.log(`[WatchParty] Socket connected: ${socket.id}`);

    // -------------------------------------------------------------------
    // JOIN PARTY
    // -------------------------------------------------------------------
    socket.on("join-party", async ({ partyId } = {}) => {
      if (!partyId) return socket.emit("error", { message: "partyId is required" });

      const { userId, username, avatarUrl } = socket.data;

      try {
        // Kiểm tra phòng tồn tại
        const parties = useMongo() ? [await mongoParty(partyId)].filter(Boolean)
          : (await pool.execute("SELECT id, status FROM watch_parties WHERE id = ? LIMIT 1", [partyId]))[0];
        if (!parties.length) return socket.emit("error", { message: "Party not found" });
        if (parties[0].status === "ended") return socket.emit("error", { message: "Party has ended" });
        let memberRole = "participant";
        if (useMongo()) {
          const part = await mongoParticipant(partyId, userId);
          if (!part) return socket.emit("error", { message: "Not in this party" });
          memberRole = part.role;
        } else {
          const [members] = await pool.execute(
            "SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ? LIMIT 1",
            [partyId, userId],
          );
          if (!members.length) return socket.emit("error", { message: "Not in this party" });
          memberRole = members[0].role;
        }

        cancelPendingDisconnect(partyId, userId);
        const existingPeers = (await partyNamespace.in(partyId).fetchSockets())
          .filter((peer) => peer.id !== socket.id)
          .map(peerDetails);

        // Join socket room
        socket.join(partyId);
        socket.data.partyId = partyId;
        socket.data.role = memberRole;
        socket.data.mediaState ||= { audioEnabled: false, videoEnabled: false };

        socket.emit("media-peers", { peers: existingPeers });
        socket.to(partyId).emit("media-peer-joined", peerDetails(socket));

        // Thông báo cho những người khác trong phòng
        socket.to(partyId).emit("party-joined", {
          userId,
          username,
          avatarUrl,
          role: memberRole,
        });

        // Gửi trạng thái playback hiện tại cho người vừa join
        const partyState = useMongo() ? parties
          : (await pool.execute("SELECT current_position, is_playing, status FROM watch_parties WHERE id = ?", [partyId]))[0];
        if (partyState.length) {
          socket.emit("playback-sync", {
            currentPosition: partyState[0].current_position,
            isPlaying: !!partyState[0].is_playing,
            updatedBy: "system",
          });
        }

        console.log(`[WatchParty] ${username} joined room ${partyId}`);
      } catch (err) {
        console.error("[WatchParty] join-party error:", err);
        socket.emit("error", { message: "Failed to join party" });
      }
    });

    // -------------------------------------------------------------------
    // LEAVE PARTY
    // -------------------------------------------------------------------
    socket.on("leave-party", async ({ partyId } = {}) => {
      if (!isJoinedSocket(socket, partyId)) return;
      const details = {
        partyId,
        userId: socket.data.userId,
        username: socket.data.username,
        peerId: socket.id,
      };
      cancelPendingDisconnect(partyId, socket.data.userId);
      socket.leave(partyId);
      socket.data.partyId = null;
      partyNamespace.to(partyId).emit("media-peer-left", {
        peerId: socket.id,
        userId: socket.data.userId,
      });
      // Grace period tránh React StrictMode/reconnect tạm thời làm mất membership.
      // Nút "Rời phòng" dùng REST API nên vẫn chuyển host ngay lập tức.
      scheduleDisconnectLeave(details);
      console.log(`[WatchParty] ${socket.data.username} left socket room ${partyId}`);
    });

    // -------------------------------------------------------------------
    // WEBRTC SIGNALING (real-time voice & camera)
    // -------------------------------------------------------------------
    socket.on("webrtc-offer", (payload) => relayWebRtcSignal(socket, "webrtc-offer", payload));
    socket.on("webrtc-answer", (payload) => relayWebRtcSignal(socket, "webrtc-answer", payload));
    socket.on("webrtc-ice-candidate", (payload) => {
      if (!payload?.candidate) return;
      relayWebRtcSignal(socket, "webrtc-ice-candidate", payload);
    });

    socket.on("media-state", ({ partyId, audioEnabled, videoEnabled } = {}) => {
      if (!isJoinedSocket(socket, partyId)) {
        return socket.emit("error", { message: "Not in this party" });
      }
      socket.data.mediaState = {
        audioEnabled: Boolean(audioEnabled),
        videoEnabled: Boolean(videoEnabled),
      };
      socket.to(partyId).emit("media-state", {
        peerId: socket.id,
        userId: socket.data.userId,
        ...socket.data.mediaState,
      });
    });

    // -------------------------------------------------------------------
    // CHAT MESSAGE (real-time broadcast)
    // -------------------------------------------------------------------
    socket.on("chat-message", async ({ partyId, message, timestampInVideo }) => {
      if (!partyId || !message?.trim()) return;

      try {
        const msg = message.trim().slice(0, 1000);
        const ts = Number(timestampInVideo) || 0;

        if (useMongo()) {
          const [part, party] = await Promise.all([
            mongoParticipant(partyId, socket.data.userId), mongoParty(partyId),
          ]);
          if (!part || !part.can_send_chat || part.is_muted || !party?.allow_chat
              || party.status === "ended") {
            return socket.emit("error", { message: "You are muted or chat is disabled" });
          }
          const { id, createdAt } = await insertMongoChat(partyId, socket.data.userId, msg, ts);
          partyNamespace.to(partyId).emit("new-chat", { id, userId: socket.data.userId,
            username: socket.data.username, avatarUrl: socket.data.avatarUrl,
            message: msg, timestampInVideo: ts, isSystemMessage: false,
            createdAt: createdAt.toISOString() });
          return;
        }

        // Kiểm tra quyền chat
        const [parts] = await pool.execute(
          "SELECT can_send_chat, is_muted FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
          [partyId, socket.data.userId],
        );
        if (!parts.length || !parts[0].can_send_chat || parts[0].is_muted) {
          return socket.emit("error", { message: "You are muted or chat is disabled" });
        }

        // Lưu vào DB
        const [result] = await pool.execute(
          `INSERT INTO watch_party_chats (party_id, user_id, message, timestamp_in_video, is_system_message)
           VALUES (?, ?, ?, ?, 0)`,
          [partyId, socket.data.userId, msg, ts],
        );

        // Broadcast cho tất cả (bao gồm cả người gửi)
        partyNamespace.to(partyId).emit("new-chat", {
          id: result.insertId,
          userId: socket.data.userId,
          username: socket.data.username,
          avatarUrl: socket.data.avatarUrl,
          message: msg,
          timestampInVideo: ts,
          isSystemMessage: false,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[WatchParty] chat-message error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // -------------------------------------------------------------------
    // SYNC PLAYBACK (host/co-host gửi trạng thái video cho mọi người)
    // -------------------------------------------------------------------
    socket.on("sync-playback", async ({ partyId, currentPosition, isPlaying }) => {
      if (!partyId) return;

      try {
        if (useMongo()) {
          const part = await mongoParticipant(partyId, socket.data.userId);
          if (!part) return socket.emit("error", { message: "Not in this party" });
          if (!["host", "co-host"].includes(part.role) && !part.can_control_playback) {
            return socket.emit("error", { message: "No playback control permission" });
          }
          const pos = Math.max(0, Number(currentPosition) || 0);
          const playing = Boolean(isPlaying);
          const result = await (await mongoCollection("watch_parties")).updateOne({ id: partyId,
            status: { $ne: "ended" } }, { $set: { current_position: pos,
            is_playing: Number(playing), status: playing ? "playing" : "paused" } });
          if (!result.matchedCount) return socket.emit("error", { message: "Party has ended" });
          socket.to(partyId).emit("playback-sync", { currentPosition: pos,
            isPlaying: playing, updatedBy: socket.data.username });
          return;
        }
        // Kiểm tra quyền playback control
        const [parts] = await pool.execute(
          "SELECT role, can_control_playback FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
          [partyId, socket.data.userId],
        );
        if (!parts.length) return socket.emit("error", { message: "Not in this party" });
        if (!["host", "co-host"].includes(parts[0].role) && !parts[0].can_control_playback) {
          return socket.emit("error", { message: "No playback control permission" });
        }

        // Cập nhật DB
        const pos = Math.max(0, Number(currentPosition) || 0);
        const playing = isPlaying ? 1 : 0;
        await pool.execute(
          "UPDATE watch_parties SET current_position = ?, is_playing = ?, status = ? WHERE id = ?",
          [pos, playing, playing ? "playing" : "paused", partyId],
        );

        // Broadcast cho tất cả (trừ người gửi)
        socket.to(partyId).emit("playback-sync", {
          currentPosition: pos,
          isPlaying: !!playing,
          updatedBy: socket.data.username,
        });
      } catch (err) {
        console.error("[WatchParty] sync-playback error:", err);
      }
    });

    // -------------------------------------------------------------------
    // REQUEST SYNC (participant yêu cầu được đồng bộ lại)
    // -------------------------------------------------------------------
    socket.on("request-sync", async ({ partyId }) => {
      if (!partyId) return;
      try {
        if (useMongo()) {
          if (!await mongoParticipant(partyId, socket.data.userId)) {
            return socket.emit("error", { message: "Not in this party" });
          }
          const party = await mongoParty(partyId);
          if (party) socket.emit("playback-sync", { currentPosition: party.current_position,
            isPlaying: Boolean(party.is_playing), updatedBy: "system" });
          return;
        }
        const [partyState] = await pool.execute(
          "SELECT current_position, is_playing FROM watch_parties WHERE id = ?",
          [partyId],
        );
        if (partyState.length) {
          socket.emit("playback-sync", {
            currentPosition: partyState[0].current_position,
            isPlaying: !!partyState[0].is_playing,
            updatedBy: "system",
          });
        }
      } catch (err) {
        console.error("[WatchParty] request-sync error:", err);
      }
    });

    // -------------------------------------------------------------------
    // PARTICIPANT MANAGEMENT (host actions broadcast)
    // -------------------------------------------------------------------
    socket.on("participant-action", async ({ partyId, targetUserId, action }) => {
      if (!partyId || !targetUserId || !action) return;
      if (!["mute", "unmute", "promote", "demote", "kick"].includes(action)
          || !Number.isInteger(Number(targetUserId)) || !socket.rooms.has(partyId)) {
        return socket.emit("error", { message: "Invalid participant action" });
      }
      try {
        const host = useMongo() ? await mongoParticipant(partyId, socket.data.userId)
          : (await pool.execute("SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
            [partyId, socket.data.userId]))[0][0];
        if (!host || host.role !== "host") {
          return socket.emit("error", { message: "Only host can manage participants" });
        }
      } catch {
        return socket.emit("error", { message: "Failed to manage participants" });
      }

      // Broadcast action to all in the room
      partyNamespace.to(partyId).emit("participant-updated", {
        userId: targetUserId,
        action,
        updatedBy: socket.data.userId,
      });

      // Nếu kick, forced leave the target user
      if (action === "kick") {
        // Tìm socket của user bị kick
        const sockets = await partyNamespace.in(partyId).fetchSockets();
        for (const s of sockets) {
          if (s.data.userId === Number(targetUserId)) {
            s.leave(partyId);
            s.data.partyId = null;
            partyNamespace.to(partyId).emit("media-peer-left", {
              peerId: s.id,
              userId: s.data.userId,
            });
            s.emit("party-ended", { partyId, reason: "You have been kicked from the party" });
          }
        }
      }
    });

    // -------------------------------------------------------------------
    // END PARTY (host kết thúc phòng)
    // -------------------------------------------------------------------
    socket.on("end-party", async ({ partyId }) => {
      if (!partyId) return;
      try {
        if (useMongo()) {
          const part = await mongoParticipant(partyId, socket.data.userId);
          if (!part || part.role !== "host") {
            return socket.emit("error", { message: "Only host can end the party" });
          }
          await (await mongoCollection("watch_parties")).updateOne({ id: partyId },
            { $set: { status: "ended" } });
          partyNamespace.to(partyId).emit("party-ended", { partyId, reason: "Host ended the party" });
          await insertMongoChat(partyId, socket.data.userId, "Host đã kết thúc phòng xem.", 0, true);
          return;
        }
        // Kiểm tra quyền
        const [parts] = await pool.execute(
          "SELECT role FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
          [partyId, socket.data.userId],
        );
        if (!parts.length || parts[0].role !== "host") {
          return socket.emit("error", { message: "Only host can end the party" });
        }

        await pool.execute("UPDATE watch_parties SET status = 'ended' WHERE id = ?", [partyId]);

        // Thông báo cho tất cả
        partyNamespace.to(partyId).emit("party-ended", { partyId, reason: "Host ended the party" });

        // Tin nhắn hệ thống
        await pool.execute(
          `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
           VALUES (?, ?, ?, 1)`,
          [partyId, socket.data.userId, "Host đã kết thúc phòng xem."],
        );
      } catch (err) {
        console.error("[WatchParty] end-party error:", err);
      }
    });

    // -------------------------------------------------------------------
    // DISCONNECT
    // -------------------------------------------------------------------
    socket.on("disconnect", () => {
      const { partyId, username, userId } = socket.data;
      if (partyId) {
        scheduleDisconnectLeave({
          partyId,
          username,
          userId,
          peerId: socket.id,
        });
      }
      console.log(`[WatchParty] Socket disconnected: ${socket.id} (${username || "unknown"})`);
    });
  });

  return partyNamespace;
};
