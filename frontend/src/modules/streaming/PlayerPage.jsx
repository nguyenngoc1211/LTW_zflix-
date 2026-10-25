import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest, API_URL } from "../../services/api.js";
import { scanRegion as scanRegionApi } from "../../services/scanApi.js";
import { captureVideoRegion } from "../../utils/videoCapture.js";
import LensyMascot from "../../components/LensyMascot.jsx";
import SelectionOverlay from "../../components/SelectionOverlay.jsx";
import ProductPanel from "../../components/ProductPanel.jsx";

// ---------------------------------------------------------------------------
// Overlay quét đồ vật kiểu Google Lens: kéo chuột khoanh vùng trên video
// ---------------------------------------------------------------------------
const PlayerPage = () => {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [position, setPosition] = useState(0);
  const videoRef = useRef(null);
  const lastSaved = useRef(0);
  const stageRef = useRef(null);
  // CineLens: SLEEPING -> AWAKE -> SELECTING -> SCANNING -> RESULTS / ERROR
  const [lensyState, setLensyState] = useState("SLEEPING");
  const [lensyResult, setLensyResult] = useState(null);
  const [lensyPhoto, setLensyPhoto] = useState(null);
  const [lensyError, setLensyError] = useState("");
  // Bật crossOrigin để chụp khung hình cho AI; host video không CORS sẽ fallback tắt nó
  const [videoNoCors, setVideoNoCors] = useState(false);
  useEffect(() => { apiRequest(`/api/v1/episodes/${episodeId}`).then(setEpisode); }, [episodeId]);
  const save = (seconds) => {
    if (Math.abs(seconds - lastSaved.current) < 10) return;
    lastSaved.current = seconds;
    apiRequest(`/api/v1/history/${episodeId}`, { method: "PUT", body: JSON.stringify({ position: seconds }) }).catch(() => {});
  };
  if (!episode) return <main className="page-shell"><p className="empty">Đang tải tập phim...</p></main>;

  // === CineLens: điều khiển trạng thái Lensy ===
  const wakeLensy = () => {
    setLensyError("");
    setLensyState("AWAKE");
  };
  const sleepLensy = () => {
    setLensyState("SLEEPING");
    setLensyResult(null);
    setLensyPhoto(null);
    setLensyError("");
  };

  // Quét: crop chính xác vùng (letterbox) -> multipart -> backend CLIP + HNSW
  const handleScanRegion = async (rect) => {
    window.__lensyDebug = (window.__lensyDebug || []).concat("scan-called rect=" + Math.round(rect.w) + "x" + Math.round(rect.h));
    setLensyState("SCANNING");
    try {
      const { blob, dataUrl, cropMs } = captureVideoRegion(
        videoRef.current, rect, stageRef.current?.clientWidth, stageRef.current?.clientHeight,
      );
      setLensyPhoto(dataUrl);
      window.__lensyDebug = (window.__lensyDebug || []).concat("photo=" + Math.round(dataUrl.length / 1024) + "KB");
      const result = await scanRegionApi({
        blob, movieId: episode.production_id, position, cropMs,
      });
      setLensyResult(result);
      window.__lensyDebug = (window.__lensyDebug || []).concat("results=" + result.products?.length);
      setLensyState("RESULTS");
    } catch (e) {
      setLensyError(e.message || "Lensy gặp lỗi khi quét");
      setLensyState("ERROR");
    }
  };

  // Mua: backend xác thực + ghi affiliate_clicks + 302 sang sàn (không nhận URL từ client)
  const buyProduct = (product) => {
    window.open(
      `${API_URL}/api/v1/affiliate/redirect/${product.id}${lensyResult?.searchId ? `?searchId=${lensyResult.searchId}` : ""}`,
      "_blank",
      "noopener",
    );
  };
  // Chưa gắn affiliate: mở Shopee search theo tên (URL-encoded, tab mới)
  const findOnShopee = (name) => {
    window.open(`https://shopee.vn/search?keyword=${encodeURIComponent(name)}`, "_blank", "noopener");
  };


  return (
    <main className="page-shell player-page">
      <div className="player-main">
        <Link to={`/movies/${episode.production_id}`}>← {episode.production_title}</Link>
        <h1>Tập {episode.episode_number}: {episode.title}</h1>
        <div className="player-stage" ref={stageRef}>
          {episode.video_url ? (
            <video
              ref={videoRef}
              controls
              autoPlay
              src={episode.video_url}
              {...(videoNoCors ? {} : { crossOrigin: "anonymous" })}
              onError={() => { if (!videoNoCors) setVideoNoCors(true); }}
              onTimeUpdate={(e) => { setPosition(e.currentTarget.currentTime); save(Math.floor(e.currentTarget.currentTime)); }}
              onPause={(e) => save(Math.floor(e.currentTarget.currentTime))}
            />
          ) : (
            <div className="video-placeholder"><span>▶</span><p>Chưa có URL video trong dữ liệu mẫu.</p></div>
          )}
          {lensyState !== "SLEEPING" && (
            <SelectionOverlay
              boundsRef={stageRef}
              scanning={lensyState === "SCANNING"}
              onScan={handleScanRegion}
              onCancel={sleepLensy}
              onTooSmall={(message) => setLensyError(message)}
              error={lensyError}
            />
          )}
        </div>
        <div className="manual-progress">
          <label>Vị trí xem thử: {Math.floor(position)} giây</label>
          <input type="range" min="0" max={episode.duration} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
          <button onClick={() => save(Math.floor(position))}>Lưu vị trí xem</button>
        </div>
      </div>
      {(lensyState === "RESULTS" || lensyState === "ERROR") && (
        <ProductPanel
          result={lensyResult || { message: lensyError, products: [] }}
          photo={lensyPhoto}
          onClose={() => sleepLensy()}
          onBuy={buyProduct}
          onFind={findOnShopee}
        />
      )}
      <LensyMascot state={lensyState} onClick={() => (lensyState === "SLEEPING" ? wakeLensy() : sleepLensy())} />
    </main>
  );
};
export default PlayerPage;
