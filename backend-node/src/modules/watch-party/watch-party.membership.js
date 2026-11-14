import { pool } from "../../core/database/pool.js";
import {
  mongoCollection,
  nextNumericId,
  withMongoTransaction,
} from "../../core/database/mongo.js";
import { selectNextHost } from "./watch-party.host-order.js";

const useMongo = () => process.env.DATA_STORE === "mongodb";

const hostTransferMessage = (leavingName, nextHostName) =>
  `${leavingName} đã rời phòng. ${nextHostName} đã tiếp quản vai trò Host.`;

const regularLeaveMessage = (leavingName) => `${leavingName} đã rời phòng.`;

const insertMongoSystemChat = async (partyId, userId, message, session) => {
  const id = await nextNumericId("watch_party_chats");
  await (await mongoCollection("watch_party_chats")).insertOne({
    _id: id,
    id,
    party_id: partyId,
    user_id: userId,
    message,
    timestamp_in_video: 0,
    is_system_message: 1,
    created_at: new Date(),
  }, { session });
};

const leaveMongoParty = async ({ partyId, userId, username }) =>
  withMongoTransaction(async (session) => {
    const parties = await mongoCollection("watch_parties");
    const participants = await mongoCollection("watch_party_participants");
    const users = await mongoCollection("users");

    // MongoDB driver không hỗ trợ chạy song song nhiều operation trong cùng transaction.
    const party = await parties.findOne({ id: partyId }, { session });
    const participant = await participants.findOne(
      { party_id: partyId, user_id: userId },
      { session },
    );

    if (!party || !participant) {
      return { left: false, alreadyLeft: true, partyId, userId, username };
    }

    const leavingName = username || `Thành viên #${userId}`;
    const wasHost = participant.role === "host" || Number(party.host_id) === Number(userId);

    await participants.deleteOne({ party_id: partyId, user_id: userId }, { session });

    if (!wasHost) {
      const message = regularLeaveMessage(leavingName);
      await insertMongoSystemChat(partyId, userId, message, session);
      return { left: true, ended: false, partyId, userId, username: leavingName, message };
    }

    const nextHost = selectNextHost(
      await participants.find({ party_id: partyId }, { session }).toArray(),
      userId,
    );

    if (!nextHost) {
      await parties.updateOne({ id: partyId }, { $set: { status: "ended" } }, { session });
      const message = `${leavingName} đã rời phòng. Phòng đã kết thúc vì không còn thành viên.`;
      await insertMongoSystemChat(partyId, userId, message, session);
      return { left: true, ended: true, partyId, userId, username: leavingName, message };
    }

    await participants.updateMany(
      { party_id: partyId, role: "host", user_id: { $ne: nextHost.user_id } },
      { $set: { role: "participant", can_control_playback: 0 } },
      { session },
    );
    await participants.updateOne(
      { party_id: partyId, user_id: nextHost.user_id },
      { $set: { role: "host", can_control_playback: 1 } },
      { session },
    );
    await parties.updateOne(
      { id: partyId },
      { $set: { host_id: nextHost.user_id } },
      { session },
    );

    const nextHostUser = await users.findOne(
      { id: nextHost.user_id },
      { session, projection: { username: 1, avatar_url: 1 } },
    );
    const nextHostName = nextHostUser?.username || `Thành viên #${nextHost.user_id}`;
    const message = hostTransferMessage(leavingName, nextHostName);
    await insertMongoSystemChat(partyId, userId, message, session);

    return {
      left: true,
      ended: false,
      partyId,
      userId,
      username: leavingName,
      message,
      newHost: {
        userId: nextHost.user_id,
        username: nextHostName,
        avatarUrl: nextHostUser?.avatar_url || null,
      },
    };
  });

const leaveMysqlParty = async ({ partyId, userId, username }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT wp.host_id, wpp.role
       FROM watch_parties wp
       JOIN watch_party_participants wpp
         ON wpp.party_id = wp.id AND wpp.user_id = ?
       WHERE wp.id = ?
       FOR UPDATE`,
      [userId, partyId],
    );

    if (!rows.length) {
      await connection.rollback();
      return { left: false, alreadyLeft: true, partyId, userId, username };
    }

    const leavingName = username || `Thành viên #${userId}`;
    const wasHost = rows[0].role === "host" || Number(rows[0].host_id) === Number(userId);
    await connection.execute(
      "DELETE FROM watch_party_participants WHERE party_id = ? AND user_id = ?",
      [partyId, userId],
    );

    if (!wasHost) {
      const message = regularLeaveMessage(leavingName);
      await connection.execute(
        `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
         VALUES (?, ?, ?, 1)`,
        [partyId, userId, message],
      );
      await connection.commit();
      return { left: true, ended: false, partyId, userId, username: leavingName, message };
    }

    const [nextRows] = await connection.execute(
      `SELECT wpp.user_id, u.username, u.avatar_url
       FROM watch_party_participants wpp
       JOIN users u ON u.id = wpp.user_id
       WHERE wpp.party_id = ?
       ORDER BY wpp.joined_at ASC, wpp.user_id ASC
       LIMIT 1
       FOR UPDATE`,
      [partyId],
    );

    if (!nextRows.length) {
      await connection.execute("UPDATE watch_parties SET status = 'ended' WHERE id = ?", [partyId]);
      const message = `${leavingName} đã rời phòng. Phòng đã kết thúc vì không còn thành viên.`;
      await connection.execute(
        `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
         VALUES (?, ?, ?, 1)`,
        [partyId, userId, message],
      );
      await connection.commit();
      return { left: true, ended: true, partyId, userId, username: leavingName, message };
    }

    const nextHost = nextRows[0];
    await connection.execute(
      "UPDATE watch_party_participants SET role = 'participant', can_control_playback = 0 WHERE party_id = ? AND role = 'host'",
      [partyId],
    );
    await connection.execute(
      "UPDATE watch_party_participants SET role = 'host', can_control_playback = 1 WHERE party_id = ? AND user_id = ?",
      [partyId, nextHost.user_id],
    );
    await connection.execute("UPDATE watch_parties SET host_id = ? WHERE id = ?", [nextHost.user_id, partyId]);

    const message = hostTransferMessage(leavingName, nextHost.username);
    await connection.execute(
      `INSERT INTO watch_party_chats (party_id, user_id, message, is_system_message)
       VALUES (?, ?, ?, 1)`,
      [partyId, userId, message],
    );
    await connection.commit();

    return {
      left: true,
      ended: false,
      partyId,
      userId,
      username: leavingName,
      message,
      newHost: {
        userId: nextHost.user_id,
        username: nextHost.username,
        avatarUrl: nextHost.avatar_url,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const leaveWatchParty = async (details) => (
  useMongo() ? leaveMongoParty(details) : leaveMysqlParty(details)
);

export const emitWatchPartyLeave = (namespace, result, peerId = null) => {
  if (!namespace || !result?.left) return;

  namespace.to(result.partyId).emit("party-left", {
    userId: result.userId,
    username: result.username,
    message: result.message,
    hostTransferred: Boolean(result.newHost),
  });

  if (peerId) {
    namespace.to(result.partyId).emit("media-peer-left", {
      peerId,
      userId: result.userId,
    });
  }

  if (result.newHost) {
    namespace.to(result.partyId).emit("host-changed", {
      previousHostId: result.userId,
      newHostId: result.newHost.userId,
      newHostName: result.newHost.username,
      newHostAvatarUrl: result.newHost.avatarUrl,
      message: result.message,
    });
  } else if (result.ended) {
    namespace.to(result.partyId).emit("party-ended", {
      partyId: result.partyId,
      reason: "Phòng đã kết thúc vì không còn thành viên.",
    });
  }
};
