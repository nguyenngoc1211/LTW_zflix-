import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { watchPartyApi, getCurrentUserId } from "../services/api.js";
import { getPartySocket } from "../services/socket.js";
import { useAuth } from "../hooks/useAuth.js";
import { useVideoSource } from "../hooks/useVideoSource.js";

export default function PartyRoom() {
  const { partyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Ưu tiên user đã đăng nhập; fallback về localStorage test user khi chưa đăng nhập
  const currentUserId = Number(user?.id ?? getCurrentUserId());

  // Room data
  const [party, setParty] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' | 'participants' | 'settings'
  const [copiedCode, setCopiedCode] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [syncStatus, setSyncStatus] = useState("Đồng bộ");

  // Video player ref
  const videoRef = useRef(null);
  const chatBottomRef = useRef(null);
  const isLocalSeeking = useRef(false);

  // Phát qua proxy backend (URL tương đối + playback token) và hls.js cho m3u8.
  useVideoSource({ videoRef, videoUrl: party?.video_url });

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats]);

  // 1. Tải thông tin phòng từ REST API
  const loadRoomData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await watchPartyApi.getParty(partyId);
      setParty(data.party);
      setParticipants(data.participants || []);
      setChats(data.chats || []);
    } catch (err) {
      console.error("Load room error:", err);
      setErrorMsg(err.message || "Không thể tải thông tin phòng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoomData();
  }, [partyId]);

  // 2. Kết nối Socket.IO
  useEffect(() => {
    if (!party) return;

    const socket = getPartySocket();

    // Join room — danh tính do backend lấy từ access token của socket.
    socket.emit("join-party", { partyId });

    // Lắng nghe sự kiện đồng bộ video từ Host
    const handlePlaybackSync = ({ currentPosition, isPlaying, updatedBy }) => {
      setSyncStatus(`Đã đồng bộ (${updatedBy})`);
      if (videoRef.current) {
        const timeDiff = Math.abs(videoRef.current.currentTime - currentPosition);
        // Chỉ điều chỉnh nếu lệch quá 1.5 giây để tránh giật hình
        if (timeDiff > 1.5) {
          videoRef.current.currentTime = currentPosition;
        }

        if (isPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        } else if (!isPlaying && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    };

    // Lắng nghe tin nhắn chat mới
    const handleNewChat = (chatItem) => {
      setChats((prev) => [...prev, chatItem]);
    };

    // Người tham gia mới
    const handlePartyJoined = ({ userId, username, avatarUrl, role }) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.user_id === userId)) return prev;
        return [
          ...prev,
          {
            user_id: userId,
            username,
            avatar_url: avatarUrl,
            role: role || "participant",
            can_control_playback: 0,
            can_send_chat: 1,
            is_muted: 0,
          },
        ];
      });
      // Tin nhắn hệ thống
      setChats((prev) => [
        ...prev,
        {
          id: Date.now(),
          is_system_message: 1,
          message: `${username} đã tham gia phòng.`,
          created_at: new Date().toISOString(),
        },
      ]);
    };

    // Người rời phòng
    const handlePartyLeft = ({ userId, username }) => {
      setParticipants((prev) => prev.filter((p) => p.user_id !== userId));
      setChats((prev) => [
        ...prev,
        {
          id: Date.now(),
          is_system_message: 1,
          message: `${username || "Thành viên"} đã rời phòng.`,
          created_at: new Date().toISOString(),
        },
      ]);
    };

    // Quyền thành viên thay đổi (mute/kick/promote)
    const handleParticipantUpdated = ({ userId, action }) => {
      if (action === "kick" && userId === currentUserId) {
        alert("Bạn đã bị Host kick khỏi phòng xem.");
        navigate("/watch-party");
        return;
      }

      setParticipants((prev) =>
        prev.map((p) => {
          if (p.user_id === userId) {
            if (action === "mute") return { ...p, is_muted: 1 };
            if (action === "unmute") return { ...p, is_muted: 0 };
            if (action === "promote") return { ...p, role: "co-host", can_control_playback: 1 };
            if (action === "demote") return { ...p, role: "participant", can_control_playback: 0 };
          }
          return p;
        })
      );
    };

    // Host kết thúc phòng
    const handlePartyEnded = ({ reason }) => {
      alert(`Phòng xem đã kết thúc: ${reason || "Host đã đóng phòng"}`);
      navigate("/watch-party");
    };

    socket.on("playback-sync", handlePlaybackSync);
    socket.on("new-chat", handleNewChat);
    socket.on("party-joined", handlePartyJoined);
    socket.on("party-left", handlePartyLeft);
    socket.on("participant-updated", handleParticipantUpdated);
    socket.on("party-ended", handlePartyEnded);

    return () => {
      socket.off("playback-sync", handlePlaybackSync);
      socket.off("new-chat", handleNewChat);
      socket.off("party-joined", handlePartyJoined);
      socket.off("party-left", handlePartyLeft);
      socket.off("participant-updated", handleParticipantUpdated);
      socket.off("party-ended", handlePartyEnded);
      socket.emit("leave-party", { partyId });
    };
  }, [partyId, party?.id]);

  // Phân quyền người dùng hiện tại
  const myParticipant = participants.find((p) => p.user_id === currentUserId);
  const isHost = myParticipant?.role === "host";
  const isCoHost = myParticipant?.role === "co-host";
  const canControl = isHost || isCoHost || Boolean(myParticipant?.can_control_playback);
  const isMuted = Boolean(myParticipant?.is_muted);

  // Gửi sự kiện đồng bộ video từ Host
  const emitPlaybackState = (isPlayingOverride) => {
    if (!canControl || !videoRef.current) return;
    const socket = getPartySocket();
    const currentPos = Math.floor(videoRef.current.currentTime);
    const isPlaying =
      isPlayingOverride !== undefined ? isPlayingOverride : !videoRef.current.paused;

    socket.emit("sync-playback", {
      partyId,
      currentPosition: currentPos,
      isPlaying,
    });
  };

  // Các thao tác điều khiển video của Host
  const handlePlay = () => emitPlaybackState(true);
  const handlePause = () => emitPlaybackState(false);
  const handleSeeked = () => {
    isLocalSeeking.current = false;
    emitPlaybackState();
  };

  // Yêu cầu đồng bộ lại (dành cho người xem nếu bị lag)
  const handleRequestSync = () => {
    const socket = getPartySocket();
    setSyncStatus("Đang đồng bộ...");
    socket.emit("request-sync", { partyId });
  };

  // Gửi tin nhắn chat
  const handleSendMessage = (e) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (!content) return;
    if (isMuted) {
      alert("Bạn đang bị Mute, không thể gửi tin nhắn.");
      return;
    }

    const socket = getPartySocket();
    const currentVideoPos = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0;

    socket.emit("chat-message", {
      partyId,
      message: content,
      timestampInVideo: currentVideoPos,
    });

    setMessageInput("");
  };

  // Quản lý thành viên (Host actions)
  const handleManageUser = async (targetUserId, action) => {
    try {
      await watchPartyApi.manageParticipant(partyId, targetUserId, action);
      const socket = getPartySocket();
      socket.emit("participant-action", { partyId, targetUserId, action });
      loadRoomData();
    } catch (err) {
      alert(err.message || "Thao tác thất bại");
    }
  };

  // Rời phòng
  const handleLeaveParty = async () => {
    if (isHost && !confirm("Bạn là Host. Rời phòng sẽ KẾT THÚC phòng xem đối với mọi người. Bạn có chắc không?")) {
      return;
    }
    try {
      await watchPartyApi.leaveParty(partyId);
      navigate("/watch-party");
    } catch {
      navigate("/watch-party");
    }
  };

  // Copy mã phòng
  const copyPartyCode = () => {
    navigator.clipboard.writeText(partyId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Format giây thành mm:ss
  const formatTime = (secs) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? "0" : ""}${r}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-base font-semibold">Đang kết nối vào phòng xem phim #{partyId}...</p>
      </div>
    );
  }

  if (errorMsg || !party) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="p-8 rounded-3xl bg-neutral-900 border border-red-500/30 text-center">
          <div className="text-5xl mb-4">🚪</div>
          <h2 className="text-xl font-bold text-white mb-2">Không thể vào phòng</h2>
          <p className="text-sm text-neutral-400 mb-6">{errorMsg || "Phòng không tồn tại hoặc đã kết thúc."}</p>
          <button
            onClick={() => navigate("/watch-party")}
            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
          >
            Quay lại danh sách phòng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-5 animate-fadeIn">
      {/* Room Header Top Bar */}
      <div className="glass-strong rounded-2xl p-4 mb-4 border border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveParty}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Rời phòng"
          >
            <span>←</span> Rời phòng
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white line-clamp-1">{party.title}</h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                #{party.id}
                <button
                  onClick={copyPartyCode}
                  className="hover:text-white ml-1 text-[11px]"
                  title="Copy mã phòng"
                >
                  {copiedCode ? "✓ Đã copy" : "📋"}
                </button>
              </span>
            </div>
            <p className="text-xs text-neutral-400 m-0">
              Phim: <strong className="text-neutral-200">{party.production_title}</strong>{" "}
              {party.episode_title ? `(${party.episode_title})` : ""}
            </p>
          </div>
        </div>

        {/* Status badges & Controls */}
        <div className="flex items-center gap-3">
          {/* Sync indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>{syncStatus}</span>
            {!canControl && (
              <button
                onClick={handleRequestSync}
                className="ml-1 text-[11px] text-red-400 hover:underline"
                title="Bấm để đồng bộ lại nếu video bị lệch"
              >
                (Đồng bộ lại)
              </button>
            )}
          </div>

          {/* Role badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isHost
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : isCoHost
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
            }`}
          >
            {isHost ? "👑 Host" : isCoHost ? "⭐ Co-Host" : "👤 Thành viên"}
          </div>
        </div>
      </div>

      {/* Main Grid: Video Player (70%) + Chat & Members (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Video Player & Control bar */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Video Container */}
          <div className="relative rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl aspect-video flex items-center justify-center group">
            {party.locked ? (
              <div className="px-6 text-center">
                <p className="text-4xl mb-3">🔒</p>
                <p className="text-base font-bold text-white">Nội dung dành cho thành viên VIP</p>
                <p className="mt-2 text-sm text-neutral-400">
                  Bạn cần tài khoản VIP để xem phim trong phòng này. Liên hệ quản trị viên để kích hoạt.
                </p>
              </div>
            ) : (
              <video
                ref={videoRef}
                controls
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
                className="w-full h-full object-contain"
              />
            )}
            {/* Thông báo phân quyền nếu người xem không phải Host */}
            {!canControl && (
              <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl text-xs text-neutral-300 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                🔒 Host đang điều khiển video (Bạn tự động xem theo Host)
              </div>
            )}
          </div>

          {/* Quick Playback Bar */}
          <div className="p-4 rounded-2xl glass-strong border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!videoRef.current) return;
                  if (videoRef.current.paused) {
                    videoRef.current.play();
                    if (canControl) emitPlaybackState(true);
                  } else {
                    videoRef.current.pause();
                    if (canControl) emitPlaybackState(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all hover:scale-105 active:scale-95"
              >
                <span>⏯️</span> Play / Tạm dừng
              </button>

              <button
                onClick={() => {
                  if (!videoRef.current) return;
                  videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                  if (canControl) emitPlaybackState();
                }}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-all"
                title="Lùi 10 giây"
              >
                ⏪ -10s
              </button>

              <button
                onClick={() => {
                  if (!videoRef.current) return;
                  videoRef.current.currentTime += 10;
                  if (canControl) emitPlaybackState();
                }}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-all"
                title="Tiến 10 giây"
              >
                ⏩ +10s
              </button>

              <button
                onClick={handleRequestSync}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 text-xs font-semibold flex items-center gap-1 transition-all"
                title="Khớp lại với Host"
              >
                <span>🔄</span> Khớp video
              </button>
            </div>

            <div className="text-neutral-400 text-xs flex items-center gap-2">
              {canControl ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span>👑</span> Bạn là Host (Thao tác sẽ tự động đồng bộ cả phòng)
                </span>
              ) : (
                <span className="text-neutral-300">
                  Đang đồng bộ theo Host: <strong className="text-white">{party.host_name}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Chat & Participants Sidebar */}
        <div className="lg:col-span-4 flex flex-col h-[650px] glass-strong rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          {/* Tabs Switcher */}
          <div className="flex border-b border-white/10 bg-neutral-950/50">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "chat"
                  ? "text-white border-b-2 border-red-600 bg-white/5"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>💬 Trò chuyện</span>
              <span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full">{chats.length}</span>
            </button>

            <button
              onClick={() => setActiveTab("participants")}
              className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "participants"
                  ? "text-white border-b-2 border-red-600 bg-white/5"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>👥 Thành viên</span>
              <span className="text-[10px] bg-red-600/30 text-red-300 px-1.5 py-0.2 rounded-full font-bold">
                {participants.length}
              </span>
            </button>
          </div>

          {/* TAB 1: Chat Section */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chats.length === 0 && (
                  <div className="text-center py-12 text-neutral-500 text-xs">
                    Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!
                  </div>
                )}

                {chats.map((c, idx) => {
                  if (c.is_system_message) {
                    return (
                      <div key={c.id || idx} className="text-center my-2">
                        <span className="inline-block text-[11px] text-neutral-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                          📢 {c.message}
                        </span>
                      </div>
                    );
                  }

                  const isMe = c.user_id === currentUserId;

                  return (
                    <div
                      key={c.id || idx}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-bold text-neutral-300">
                          {c.username || "Thành viên"}
                        </span>
                        {c.timestamp_in_video !== undefined && (
                          <span className="text-[10px] text-red-400 font-mono bg-red-950/40 px-1.5 py-0.2 rounded">
                            {formatTime(c.timestamp_in_video)}
                          </span>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          isMe
                            ? "bg-red-600 text-white rounded-tr-none shadow-md"
                            : "bg-neutral-800 text-neutral-200 rounded-tl-none border border-white/5"
                        }`}
                      >
                        {c.message}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-neutral-950/40">
                {isMuted ? (
                  <div className="p-2 text-center text-xs text-amber-400 bg-amber-950/20 rounded-xl border border-amber-500/20">
                    🔇 Bạn đã bị Host tắt tiếng trong phòng này.
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Gửi tin nhắn trong phòng..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-white/10 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none focus:border-red-500 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!messageInput.trim()}
                      className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold shadow-md transition-all"
                    >
                      Gửi
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 2: Participants List & Host Management */}
          {activeTab === "participants" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider mb-2">
                Danh sách người trong phòng ({participants.length})
              </div>

              {participants.map((p) => {
                const isTargetHost = p.role === "host";
                const isTargetCoHost = p.role === "co-host";
                const isSelf = p.user_id === currentUserId;

                return (
                  <div
                    key={p.user_id}
                    className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 text-white text-xs font-bold flex items-center justify-center border border-white/10">
                        {p.username?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-xs text-white truncate">{p.username}</strong>
                          {isSelf && <span className="text-[10px] text-neutral-400">(Bạn)</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`text-[10px] font-semibold ${
                              isTargetHost
                                ? "text-amber-400"
                                : isTargetCoHost
                                ? "text-purple-400"
                                : "text-neutral-400"
                            }`}
                          >
                            {isTargetHost ? "👑 Host" : isTargetCoHost ? "⭐ Co-Host" : "Thành viên"}
                          </span>
                          {p.is_muted ? (
                            <span className="text-[10px] text-red-400 bg-red-950/40 px-1 rounded">
                              Đã mute
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Nút quản lý của Host */}
                    {isHost && !isTargetHost && (
                      <div className="flex items-center gap-1">
                        {/* Mute/Unmute */}
                        <button
                          onClick={() => handleManageUser(p.user_id, p.is_muted ? "unmute" : "mute")}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300"
                          title={p.is_muted ? "Mở chat" : "Tắt chat (Mute)"}
                        >
                          {p.is_muted ? "🔊" : "🔇"}
                        </button>

                        {/* Thăng cấp / Hạ cấp Co-Host */}
                        <button
                          onClick={() =>
                            handleManageUser(p.user_id, isTargetCoHost ? "demote" : "promote")
                          }
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300"
                          title={isTargetCoHost ? "Hạ cấp xuống thành viên" : "Thăng cấp lên Co-Host"}
                        >
                          {isTargetCoHost ? "⬇️" : "⭐"}
                        </button>

                        {/* Kick khỏi phòng */}
                        <button
                          onClick={() => {
                            if (confirm(`Kick ${p.username} khỏi phòng xem?`)) {
                              handleManageUser(p.user_id, "kick");
                            }
                          }}
                          className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 text-red-300 text-xs"
                          title="Kick khỏi phòng"
                        >
                          🚫
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
