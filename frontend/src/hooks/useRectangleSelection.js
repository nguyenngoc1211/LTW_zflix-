// Hook khoanh vùng kiểu Snipping Tool: pointerdown = góc A, pointermove = kéo
// hình chữ nhật real-time (hỗ trợ 4 hướng), pointerup = góc B -> tự hoàn thành.
// Escape hủy, vùng < minSize bị bỏ qua, tọa độ được kẹp trong bounds.
import { useEffect, useRef, useState } from "react";

const clampPoint = (element, clientX, clientY) => {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.min(Math.max(clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(clientY - rect.top, 0), rect.height),
  };
};

const normalize = (start, end) => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  w: Math.abs(end.x - start.x),
  h: Math.abs(end.y - start.y),
});

export function useRectangleSelection({ enabled, boundsRef, minSize = 20, onComplete, onCancel, onTooSmall }) {
  const [rect, setRect] = useState(null);
  const startPointRef = useRef(null);
  const rectRef = useRef(null);

  const reset = () => {
    startPointRef.current = null;
    rectRef.current = null;
    setRect(null);
  };

  // === Handlers: hàm thường, refs giữ trạng thái giữa các pointer events ===
  const onPointerDown = (event) => {
    if (!enabled || !boundsRef.current) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    startPointRef.current = clampPoint(event.currentTarget, event.clientX, event.clientY);
    rectRef.current = { ...startPointRef.current, w: 0, h: 0 };
    setRect({ ...startPointRef.current, w: 0, h: 0 });
  };

  const onPointerMove = (event) => {
    if (!startPointRef.current || !boundsRef.current) return;
    const end = clampPoint(event.currentTarget, event.clientX, event.clientY);
    const next = normalize(startPointRef.current, end);
    rectRef.current = next;
    setRect(next);
  };

  const onPointerUp = () => {
    if (!startPointRef.current) return;
    const finalRect = rectRef.current;
    startPointRef.current = null;
    if (!finalRect || finalRect.w < minSize || finalRect.h < minSize) {
      rectRef.current = null;
      setRect(null);
      // Vùng quá nhỏ: GIỮ chế độ chọn để người dùng thử lại
      onTooSmall?.("Vùng chọn quá nhỏ — kéo rộng hơn để Lensy nhìn rõ nhé!");
      return;
    }
    const done = finalRect;
    rectRef.current = null;
    setRect(null);
    onComplete?.(done);
  };

  // Escape hủy
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event) => {
      if (event.key === "Escape") {
        reset();
        onCancel?.("Đã hủy lựa chọn");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onCancel]);

  // Pointer handlers gắn trên overlay element
  const overlayHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: reset,
  };

  return { rect, reset, overlayHandlers };
}
