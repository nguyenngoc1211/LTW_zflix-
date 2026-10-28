import { useCallback, useRef, useState } from "react";
import { API_URL } from "../services/api.js";
import { scanRegion as scanRegionApi } from "../services/scanApi.js";
import { captureVideoRegion } from "../utils/videoCapture.js";

// CineLens: quét đồ vật trong khung hình -> CLIP + HNSW ở backend.
// Tách thành hook để dùng được ở cả route /watch/:slug (VideoPlayer) và
// /watch-episode/:id (PlayerPage) mà không lặp code.
//
// Trạng thái: SLEEPING -> AWAKE -> SELECTING -> SCANNING -> RESULTS / ERROR
export const useLensy = ({ videoRef, stageRef, productionId, position }) => {
  const [state, setState] = useState("SLEEPING");
  const [result, setResult] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const lastPosition = useRef(0);

  // Giữ vị trí video mới nhất mà không cần truyền lại mỗi lần render
  if (typeof position === "number" && position !== lastPosition.current) {
    lastPosition.current = position;
  }

  const wake = useCallback(() => {
    setError("");
    setState("AWAKE");
  }, []);

  const sleep = useCallback(() => {
    setState("SLEEPING");
    setResult(null);
    setPhoto(null);
    setError("");
  }, []);

  const scan = useCallback(
    async (rect) => {
      setState("SCANNING");
      try {
        const { blob, dataUrl, cropMs } = captureVideoRegion(
          videoRef.current,
          rect,
          stageRef.current?.clientWidth,
          stageRef.current?.clientHeight,
        );
        setPhoto(dataUrl);
        const res = await scanRegionApi({
          blob,
          movieId: productionId,
          position: Math.floor(lastPosition.current || 0),
          cropMs,
        });
        setResult(res);
        setState("RESULTS");
      } catch (e) {
        setError(e.message || "Lensy gặp lỗi khi quét");
        setState("ERROR");
      }
    },
    [videoRef, stageRef, productionId],
  );

  const buy = useCallback(
    (product) => {
      window.open(
        `${API_URL}/api/v1/affiliate/redirect/${product.id}${result?.searchId ? `?searchId=${result.searchId}` : ""}`,
        "_blank",
        "noopener",
      );
    },
    [result],
  );

  const findOnShopee = useCallback((name) => {
    window.open(`https://shopee.vn/search?keyword=${encodeURIComponent(name)}`, "_blank", "noopener");
  }, []);

  return {
    state,
    result,
    photo,
    error,
    wake,
    sleep,
    scan,
    buy,
    findOnShopee,
    setError,
    isOpen: state !== "SLEEPING",
  };
};
