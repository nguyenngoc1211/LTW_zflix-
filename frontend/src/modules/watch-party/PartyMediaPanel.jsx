import { useEffect, useRef } from "react";

const MediaVideo = ({ stream, muted = false, className = "" }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;
    if (stream) videoRef.current.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      data-party-media
      className={className}
    />
  );
};

const RemotePeerTile = ({ peer }) => (
  <div className="relative h-28 min-w-40 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
    <MediaVideo
      stream={peer.stream}
      className={`h-full w-full object-cover ${peer.videoEnabled ? "block" : "invisible"}`}
    />
    {!peer.videoEnabled && (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-600/30 text-sm font-black text-white">
          {peer.username?.[0]?.toUpperCase() || "U"}
        </div>
        <span className="max-w-32 truncate text-[11px] font-semibold text-neutral-200">
          {peer.username || "Thành viên"}
        </span>
      </div>
    )}
    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between rounded-lg bg-black/70 px-2 py-1 text-[10px] text-white backdrop-blur">
      <span className="max-w-24 truncate">{peer.username || "Thành viên"}</span>
      <span>{peer.audioEnabled ? "🎙️" : "🔇"}</span>
    </div>
  </div>
);

export default function PartyMediaPanel({
  localStream,
  remotePeers,
  micEnabled,
  cameraEnabled,
  mediaError,
  toggleMic,
  toggleCamera,
}) {
  const panelRef = useRef(null);

  const resumeRemoteMedia = () => {
    panelRef.current?.querySelectorAll("[data-party-media]").forEach((video) => {
      video.play().catch(() => {});
    });
  };

  return (
    <section ref={panelRef} className="rounded-2xl border border-white/10 bg-neutral-900/70 p-3 shadow-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">Voice & camera trực tiếp</h3>
          <p className="text-[11px] text-neutral-400">WebRTC kết nối trực tiếp giữa các thành viên trong phòng.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resumeRemoteMedia}
            className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold text-neutral-200 hover:bg-white/15"
          >
            🔊 Bật âm thanh phòng
          </button>
          <button
            type="button"
            onClick={toggleMic}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              micEnabled ? "bg-green-600 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            }`}
          >
            {micEnabled ? "🎙️ Tắt micro" : "🔇 Mở micro"}
          </button>
          <button
            type="button"
            onClick={toggleCamera}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              cameraEnabled ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            }`}
          >
            {cameraEnabled ? "📹 Tắt camera" : "🎥 Mở camera"}
          </button>
        </div>
      </div>

      {mediaError && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {mediaError}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-1">
        {(cameraEnabled || micEnabled) && (
          <div className="relative h-28 min-w-40 overflow-hidden rounded-2xl border border-red-500/30 bg-neutral-950">
            <MediaVideo
              stream={localStream}
              muted
              className={`h-full w-full object-cover ${cameraEnabled ? "block" : "invisible"}`}
            />
            {!cameraEnabled && (
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🎙️</div>
            )}
            <span className="absolute bottom-1.5 left-1.5 rounded-lg bg-red-600/80 px-2 py-1 text-[10px] font-bold text-white">
              Bạn {micEnabled ? "· 🎙️" : "· 🔇"}
            </span>
          </div>
        )}

        {remotePeers.map((peer) => <RemotePeerTile key={peer.peerId} peer={peer} />)}

        {!remotePeers.length && !cameraEnabled && !micEnabled && (
          <div className="flex h-20 w-full items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-neutral-500">
            Mở micro hoặc camera để bắt đầu trò chuyện.
          </div>
        )}
      </div>
    </section>
  );
}
