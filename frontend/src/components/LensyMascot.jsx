// Lensy — linh vật kính lúp AI Visual Shopping.
// States: SLEEPING (mặc định, mắt nhắm + Zzz) -> AWAKE (mắt mở + glow) ->
// SELECTING/SCANNING/RESULTS/ERROR (biểu cảm thay đổi theo state).
export default function LensyMascot({ state, onClick, compact = false, inline = false }) {
  const sleeping = state === "SLEEPING";
  const scanning = state === "SCANNING";
  const error = state === "ERROR";
  const variant = inline ? "lensy-inline" : compact ? "lensy-compact" : "";
  return (
    <button
      type="button"
      className={`lensy ${variant} ${sleeping ? "lensy-sleeping" : "lensy-awake"} lensy-${state.toLowerCase()}`}
      onClick={onClick}
      title={sleeping ? "Đánh thức Lensy để tìm món đồ bạn thích" : "Bấm vào mình để quay lại ngủ"}
      aria-label="Lensy - trợ lý tìm kiếm sản phẩm trong phim"
    >
      <svg viewBox="0 0 100 100" className="lensy-svg" aria-hidden="true">
        <defs>
          <linearGradient id="lensy-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id="lensy-inner" cx="0.4" cy="0.35" r="0.9">
            <stop offset="0%" stopColor="rgba(30,41,59,.92)" />
            <stop offset="100%" stopColor="rgba(10,14,24,.96)" />
          </radialGradient>
        </defs>

        {/* Cán kính lúp */}
        <line x1="60" y1="60" x2="88" y2="88" stroke={error ? "#f87171" : "url(#lensy-glass)"} strokeWidth="11" strokeLinecap="round" />

        {/* Viền kính — phát sáng khi thức */}
        <circle
          cx="42" cy="42" r="27"
          fill="url(#lensy-inner)"
          stroke={error ? "#f87171" : "url(#lensy-glass)"}
          strokeWidth="6"
        />

        {/* Mắt: nhắm khi ngủ, mở khi thức */}
        {sleeping ? (
          <>
            <path d="M28 42 Q34 48 40 42" stroke="#e2e8f0" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M46 42 Q52 48 58 42" stroke="#e2e8f0" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="34" cy="42" r="5.5" fill="#e2e8f0" />
            <circle cx="52" cy="42" r="5.5" fill="#e2e8f0" />
            <circle cx={scanning ? 34 : 35.5} cy={scanning ? 42 : 40.5} r="2.8" fill="#7c3aed" />
            <circle cx={scanning ? 52 : 53.5} cy={scanning ? 42 : 40.5} r="2.8" fill="#7c3aed" />
            <circle cx="35.5" cy="40" r="1" fill="#fff" />
            <circle cx="53.5" cy="40" r="1" fill="#fff" />
          </>
        )}

        {/* Má hồng + miệng */}
        <ellipse cx="28" cy="50" rx="3.4" ry="2" fill={error ? "#fca5a5" : "#f9a8d4"} opacity=".8" />
        <ellipse cx="56" cy="50" rx="3.4" ry="2" fill={error ? "#fca5a5" : "#f9a8d4"} opacity=".8" />
        {error ? (
          <path d="M36 55 Q42 50 48 55" stroke="#fca5a5" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M37 53 Q42 57 47 53" stroke="#e2e8f0" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}

        {/* Zzz khi ngủ */}
        {sleeping && (
          <g fill="#a78bfa" fontWeight="900">
            <text x="66" y="26" fontSize="13" opacity=".95">z</text>
            <text x="76" y="17" fontSize="10" opacity=".7">z</text>
            <text x="84" y="10" fontSize="8" opacity=".45">z</text>
          </g>
        )}
        {/* Sparkle khi quét */}
        {scanning && (
          <g stroke="#22d3ee" strokeWidth="2" strokeLinecap="round">
            <line x1="10" y1="14" x2="16" y2="20" />
            <line x1="16" y1="14" x2="10" y2="20" />
            <line x1="88" y1="52" x2="94" y2="58" />
            <line x1="94" y1="52" x2="88" y2="58" />
          </g>
        )}
      </svg>
    </button>
  );
}
