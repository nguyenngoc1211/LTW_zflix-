// Overlay khoanh vùng kiểu Snipping Tool: pointerdown = góc A, kéo real-time
// (4 hướng), pointerup = góc B -> tự quét. Escape hủy, bỏ qua vùng < 20×20.
import { useRectangleSelection } from "../hooks/useRectangleSelection.js";

export default function SelectionOverlay({ boundsRef, scanning, minSize = 20, onScan, onCancel, onTooSmall, error, hint }) {
  const { rect, overlayHandlers } = useRectangleSelection({
    enabled: !scanning,
    boundsRef,
    minSize,
    onComplete: (rect) => onScan(rect),
    onCancel: () => onCancel?.(),
    onTooSmall: (message) => onTooSmall?.(message),
  });

  return (
    <div
      className={`cinelens-overlay ${scanning ? "cinelens-scanning" : ""}`}
      {...overlayHandlers}
      role="application"
      aria-label="Khoanh vùng món đồ trên video"
    >
      {rect && rect.w >= 4 && (
        <div
          className="cinelens-rect"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        >
          <span className="cinelens-rect-size">{Math.round(rect.w)}×{Math.round(rect.h)}</span>
          {/* 4 góc nổi bật */}
          <span className="cinelens-corner tl" />
          <span className="cinelens-corner tr" />
          <span className="cinelens-corner bl" />
          <span className="cinelens-corner br" />
          {scanning && <div className="cinelens-laser" />}
        </div>
      )}
      {error && !scanning && <div className="cinelens-hint cinelens-hint-error">{error}</div>}
      <div className="cinelens-hint">
        {scanning
          ? "🔍 Lensy đang tìm món đồ này..."
          : hint || "Kéo chuột khoanh vùng món đồ — thả ra để Lensy quét · Esc hủy"}
      </div>
    </div>
  );
}
