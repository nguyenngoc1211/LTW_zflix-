// Hook khoanh vùng kiểu Snipping Tool: pointerdown = góc A, pointermove = kéo
// hình chữ nhật real-time (hỗ trợ 4 hướng), pointerup = góc B -> tự hoàn thành.
// Escape hủy, vùng < minSize bị bỏ qua, tọa độ được kẹp trong bounds.
import { useCallback, useEffect, useRef, useState } from "react";

const clampPoint = (element, clientX, clientY) => {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.min(Math.max(clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(clientY - rect.top, 0), rect.height),
  };
};

export function useRectangleSelection({ enabled, boundsRef, minSize = 20, onComplete, onCancel }) {
  const [rect, setRect] = useState(null);
  const startPointRef = useRef(null);
  const rectRef = useRef(null);

  const normalize = (start, end) => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  });

  const reset = useCallback(() => {
    startPointRef.current = null;
    rectRef.current = null;
    setRect(null);
  }, []);

  const onPointerDown = useCallback((event) => {
    if (!enabled || !event.currentTarget) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    window.__selLog = (window.__selLog || []).concat("down");
    startPointRef.current = clampPoint(event.currentTarget, event.clientX, event.clientY);
    window.__selLog = (window.__selLog || []).concat("down-OK start=" + Boolean(startPointRef.current));
    setRect({ ...startPointRef.current, w: 0, h: 0 });
  }, [enabled, boundsRef]);

  const onPointerMove = useCallback((event) => {
    if (!startPointRef.current || !event.currentTarget) {
      window.__selLog = (window.__selLog || []).concat("move-KHÔNG-chạy(start=" + Boolean(startPointRef.current) + ")");
      return;
    }
    window.__selLog = (window.__selLog || []).concat("move");
    const end = clampPoint(event.currentTarget, event.clientX, event.clientY);
    const next = normalize(startPointRef.current, end);
    rectRef.current = next;
    setRect(next);
  }, [boundsRef]);

  const onPointerUp = useCallback(() => {
    window.__selLog = (window.__selLog || []).concat("up");
    if (!startPointRef.current) return;
    const finalRect = rectRef.current;
    startPointRef.current = null;
    if (!finalRect || finalRect.w < minSize || finalRect.h < minSize) {
      reset();
      onCancel?.("Vùng chọn quá nhỏ — kéo rộng hơn để Lensy nhìn rõ nhé!");
      return;
    }
    const done = finalRect;
    setRect(null);
    onComplete?.(done);
  }, [minSize, onComplete, onCancel, reset]);

  // Escape hủy — listener window
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
  }, [enabled, onCancel, reset]);

  // Pointer handlers gắn trên overlay element
  const overlayHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: reset,
  };

  return { rect, reset, overlayHandlers };
}
