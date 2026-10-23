import { pool } from "../../core/database/pool.js";

/**
 * Watch Party Socket.IO handler
 *
 * Events (Client → Server):
 *   join-party       { partyId }
 *   leave-party      { partyId }
 *   chat-message     { partyId, message, timestampInVideo }
 *   sync-playback    { partyId, currentPosition, isPlaying }
 *   request-sync     { partyId }
 *
 * Events (Server → Client):
 *   party-joined     { userId, username, avatarUrl, role }
 *   party-left       { userId, username }
 *   new-chat         { id, userId, username, avatarUrl, message, timestampInVideo, isSystemMessage, createdAt }
 *   playback-sync    { currentPosition, isPlaying, updatedBy }
 *   party-ended      { partyId }
 *   participant-updated { userId, action, ... }
 *   error            { message }
 */

export const registerWatchPartySocket = (io) => {
  const partyNamespace = io.of("/watch-party");

  partyNamespace.on("connection", (socket) => {
    console.log(`[WatchParty] Socket connected: ${socket.id}`);

    // -------------------------------------------------------------------
    // JOIN PARTY
    // -------------------------------------------------------------------
    socket.on("join-party", async ({ partyId, userId, username, avatarUrl }) => {
      if (!partyId) return socket.emit("error", { message: "partyId is required" });

      try {
        // Kiểm tra phòng tồn tại
        const [parties] = await pool.execute(
          "SELECT id, status FROM watch_parties WHERE id = ? LIMIT 1",
          [partyId],
        );
        if (!parties.length) return socket.emit("error", { message: "Party not found" });
        if (parties[0].status === "ended") return socket.emit("error", { message: "Party has ended" });

        // Join socket room
        socket.join(partyId);
        socket.data.partyId = partyId;
        socket.data.userId = userId;
        socket.data.username = username;
        socket.data.avatarUrl = avatarUrl;

        // Thông báo cho những người khác trong phòng
        socket.to(partyId).emit("party-joined", {
          userId,
          username,
          avatarUrl,
          role: "participant",
        });

        // Gửi trạng thái playback hiện tại cho người vừa join
        const [partyState] = await pool.execute(
          "SELECT current_position, is_playing, status FROM watch_parties WHERE id = ?",
          [partyId],
        );
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
    socket.on("leave-party", ({ partyId }) => {
      if (!partyId) return;
      socket.leave(partyId);
      socket.to(partyId).emit("party-left", {
        userId: socket.data.userId,
        username: socket.data.username,
      });
      console.log(`[WatchParty] ${socket.data.username} left room ${partyId}`);
    });

    // -------------------------------------------------------------------
    // CHAT MESSAGE (real-time broadcast)
    // -------------------------------------------------------------------
    socket.on("chat-message", async ({ partyId, message, timestampInVideo }) => {
      if (!partyId || !message?.trim()) return;

      try {
        const msg = message.trim().slice(0, 1000);
        const ts = Number(timestampInVideo) || 0;

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
          if (s.data.userId === targetUserId) {
            s.leave(partyId);
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
        socket.to(partyId).emit("party-left", { userId, username });
      }
      console.log(`[WatchParty] Socket disconnected: ${socket.id} (${username || "unknown"})`);
    });
  });

  return partyNamespace;
};
