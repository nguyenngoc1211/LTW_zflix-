import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest, API_URL } from "../../services/api.js";
import { dominantColorName } from "../../utils/colorName.js";

// ---------------------------------------------------------------------------
// Overlay quét đồ vật kiểu Google Lens: kéo chuột khoanh vùng trên video
// ---------------------------------------------------------------------------
const LensOverlay = ({ episode, position, videoRef, onResult, onClose }) => {
  const containerRef = useRef(null);
  const [rect, setRect] = useState(null);
  const dragStartRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    const wasPlaying = video && !video.paused;
    video?.pause();
    return () => {
      if (wasPlaying) video?.play().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localPoint = (clientX, clientY) => {
    const bounds = containerRef.current.getBoundingClientRect();
    return {
      x: Math.min(Math.max(clientX - bounds.left, 0), bounds.width),
      y: Math.min(Math.max(clientY - bounds.top, 0), bounds.height),
    };
  };

  const startDrag = (clientX, clientY) => {
    dragStartRef.current = localPoint(clientX, clientY);
  };
  const moveDrag = (clientX, clientY) => {
    const start = dragStartRef.current;
    if (!start) return;
    const point = localPoint(clientX, clientY);
    setRect({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    });
  };

  const scanRegion = async () => {
    setBusy(true);
    setError("");
    const cropStart = performance.now();
    try {
      // 1. Crop ảnh vùng khoanh từ frame video (nếu canvas không bị CORS taint)
      let photo = null;
      let dominantColor = null;
      try {
        const video = videoRef.current;
        const container = containerRef.current;
        if (video?.videoWidth && rect && rect.w > 8 && rect.h > 8) {
          const scaleX = video.videoWidth / container.clientWidth;
          const scaleY = video.videoHeight / container.clientHeight;
          const canvas = document.createElement("canvas");
          let w = Math.max(2, Math.round(rect.w * scaleX));
          let h = Math.max(2, Math.round(rect.h * scaleY));
          // Thu nhỏ để AI xử lý nhanh hơn
          if (w > 512) {
            h = Math.round((512 / w) * h);
            w = 512;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, Math.round(rect.x * scaleX), Math.round(rect.y * scaleY), Math.max(2, Math.round(rect.w * scaleX)), Math.max(2, Math.round(rect.h * scaleY)), 0, 0, w, h);
          photo = canvas.toDataURL("image/jpeg", 0.7);
          // Màu chủ đạo của vùng quét — lọc kết quả theo màu như TikTok
          try {
            const pixelData = ctx.getImageData(0, 0, w, h).data;
            dominantColor = dominantColorName(pixelData);
          } catch { /* canvas tainted */ }
        }
      } catch {
        // video domain khác làm canvas tainted — không gửi ảnh được
      }

      // 2. CLIP embedding + HNSW vector search trên catalog (tức thời)
      const cropMs = Math.round(performance.now() - cropStart);
      const result = await apiRequest("/api/v1/visual-search", {
        method: "POST",
        body: JSON.stringify({
          movieId: episode.production_id,
          position: Math.floor(position),
          image: photo,
          cropMs,
          aiFilters: dominantColor ? { color: dominantColor } : {},
        }),
      });

      onResult(result, photo);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="lens-overlay"
      onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
      onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
      onMouseUp={() => { dragStartRef.current = null; }}
      onTouchStart={(e) => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
      onTouchMove={(e) => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }}
      onTouchEnd={() => { dragStartRef.current = null; }}
    >
      <div className="lens-toolbar">
        <strong>🔍 Quét đồ vật</strong>
        <span>{rect && rect.w > 8 ? "Đã khoanh vùng — bấm Quét" : "Kéo chuột khoanh vùng món đồ"}</span>
        <button type="button" disabled={busy || !rect || rect.w < 8} onClick={scanRegion}>
          {busy ? "Đang quét..." : "Quét vùng này"}
        </button>
        <button type="button" className="secondary" onClick={onClose}>Hủy</button>
      </div>
      {error && <p className="lens-error">{error}</p>}
      {rect && (
        <div
          className="lens-rect"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        >
          <span className="lens-rect-size">{Math.round(rect.w)}×{Math.round(rect.h)}</span>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thẻ kết quả quét hiện ngay trên video
// ---------------------------------------------------------------------------
const LensResult = ({ result, photo, onBuy, onFindShopee, onClose }) => {
  const items = result.products || [];
  const formatVnd = (raw) =>
    raw ? new Intl.NumberFormat("vi-VN").format(Number(raw)) + "₫" : null;
  return (
    <div className="lens-result">
      <div className="lens-result-head">
        <strong>{items.length > 0 ? `Tìm thấy ${items.length} sản phẩm` : "Không tìm thấy sản phẩm"}</strong>
        <button type="button" className="lens-close" onClick={onClose}>✕</button>
      </div>
      {photo && <img className="lens-result-photo" src={photo} alt="Vùng đã quét" />}
      {result.ocrText && (
        <p className="lens-ai-badge">📜 OCR đọc được: “{result.ocrText}”</p>
      )}
      {items.length === 0 && (
        <p className="lens-result-note">{result.message || "Thử khoanh vùng món đồ rõ hơn hoặc tìm theo từ khoá."}</p>
      )}
      {items.map((item) => (
        <div key={item.id} className="lens-product-card">
          <img className="lens-item-img" src={item.imageUrl} alt="" loading="lazy" />
          <div className="lens-product-info">
            <strong>{item.name}</strong>
            {item.category && <small>{item.category}</small>}
            <small>
              {item.price ? formatVnd(item.price) : "—"}
              {item.similarity != null ? ` · giống ${(item.similarity * 100).toFixed(0)}%` : ""}
              {` · ${item.marketplace === "catalog" ? "Zflix Catalog" : item.marketplace}`}
            </small>
          </div>
          {item.hasAffiliate ? (
            <button type="button" onClick={() => onBuy(item)}>Mua</button>
          ) : (
            <button type="button" className="secondary" onClick={() => onFindShopee(item.name)} title="Sản phẩm chưa gắn link affiliate">
              Tìm Shopee
            </button>
          )}
        </div>
      ))}
      <p className="lens-ai-note">
        {result.timings ? `CLIP ${result.timings.embedMs}ms · tìm ${result.timings.searchMs}ms · tổng ${result.timings.totalMs}ms` : ""}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Linh vật thỏ "Quét đồ vật" — kéo-thả lên món đồ là quét (drag-to-scan)
// ---------------------------------------------------------------------------
const ScanMascot = ({ stageRef, onScanRegion }) => {
  const [armed, setArmed] = useState(false); // đang trong chế độ chọn điểm quét
  const [ghost, setGhost] = useState(null); // tâm vòng quét trong player-stage (px)
  const armedRef = useRef(false);
  const ghostRef = useRef(null);

  // Kích hoạt: click linh vật → di chuột: ghost theo chuột → click lần 2: quét
  useEffect(() => {
    const stagePoint = (clientX, clientY) => {
      const bounds = stageRef.current.getBoundingClientRect();
      return {
        x: Math.min(Math.max(clientX - bounds.left, 90), bounds.width - 90),
        y: Math.min(Math.max(clientY - bounds.top, 90), bounds.height - 90),
      };
    };
    const onMouseDown = (event) => {
      if (!armedRef.current) return;
      if (event.target?.closest?.(".scan-mascot")) return; // click mascot = hủy chế độ quét
      const point = stagePoint(event.clientX, event.clientY);
      ghostRef.current = point;
      setGhost(point);
    };
    const onMouseMove = (event) => {
      if (!armedRef.current) return;
      const point = stagePoint(event.clientX, event.clientY);
      ghostRef.current = point;
      setGhost(point);
    };
    const onMouseUpScan = () => {
      if (!armedRef.current) return;
      armedRef.current = false;
      setArmed(false);
      const point = ghostRef.current;
      setGhost(null);
      if (point) onScanRegion({ x: point.x - 90, y: point.y - 90, w: 180, h: 180 });
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUpScan);
    window.addEventListener("touchmove", (e) => { if (e.touches[0]) onMouseMove(e.touches[0]); }, { passive: false });
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUpScan);
    };
  }, [stageRef, onScanRegion]);

  const arm = (clientX, clientY) => {
    armedRef.current = true;
    setArmed(true);
    const bounds = stageRef.current.getBoundingClientRect();
    const point = {
      x: Math.min(Math.max(clientX - bounds.left, 90), bounds.width - 90),
      y: Math.min(Math.max(clientY - bounds.top, 90), bounds.height - 90),
    };
    ghostRef.current = point;
    setGhost(point);
  };

  return (
    <>
      <div
        className={armed ? "scan-mascot armed" : "scan-mascot"}
        title="Bấm vào mình rồi di chuột lên món đồ muốn mua!"
        onMouseDown={(e) => {
          window.__mascotLog = (window.__mascotLog || []).concat('jsx-md armed=' + armedRef.current);
          e.preventDefault();
          if (!armedRef.current) arm(e.clientX, e.clientY);
          else { armedRef.current = false; setArmed(false); setGhost(null); }
        }}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <ellipse cx="24" cy="12" rx="5.5" ry="14" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" transform="rotate(-12 24 12)" />
          <ellipse cx="40" cy="12" rx="5.5" ry="14" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" transform="rotate(12 40 12)" />
          <ellipse cx="24" cy="14" rx="2.5" ry="9" fill="#fecdd3" transform="rotate(-12 24 14)" />
          <ellipse cx="40" cy="14" rx="2.5" ry="9" fill="#fecdd3" transform="rotate(12 40 14)" />
          <circle cx="32" cy="34" r="19" fill="#fff" stroke="#e5e7eb" strokeWidth="1.5" />
          <circle cx="25" cy="31" r="3.2" fill="#1f2937" />
          <circle cx="39" cy="31" r="3.2" fill="#1f2937" />
          <circle cx="26.2" cy="29.8" r="1.1" fill="#fff" />
          <circle cx="40.2" cy="29.8" r="1.1" fill="#fff" />
          <ellipse cx="20" cy="37" rx="3.5" ry="2.2" fill="#fda4af" />
          <ellipse cx="44" cy="37" rx="3.5" ry="2.2" fill="#fda4af" />
          <path d="M29 38 Q32 41 35 38" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <ellipse cx="32" cy="36" rx="2.4" ry="1.7" fill="#f43f5e" />
        </svg>
        <span className="scan-mascot-label">{armed ? "Chọn đồ..." : "Quét"}</span>
      </div>
      {armed && ghost && (
        <div className="mascot-ghost" style={{ left: ghost.x - 90, top: ghost.y - 90 }}>
          <div className="mascot-ghost-ring" />
          <span className="mascot-ghost-hint">Bấm để quét vùng này</span>
        </div>
      )}
    </>
  );
};

const ShoppingPanel = ({ episode, position, onOpenLens }) => {
  const [products, setProducts] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/api/v1/shopping/productions/${episode.production_id}/products`)
      .then((data) => setProducts(data.items))
      .catch(() => {});
  }, [episode.production_id]);

  // Sản phẩm đúng thời điểm hiện tại
  const activeProducts = products.filter(
    (item) => position >= item.timestampStart && position <= item.timestampEnd,
  );

  // Bấm mua: tạo link affiliate lúc này rồi mới điều hướng sang Shopee
  const openBuy = async (product) => {
    try {
      const data = await apiRequest(`/api/v1/shopping/products/${product.id}/buy`, { method: "POST" });
      window.open(data.buyUrl, "_blank", "noopener");
    } catch {
      window.open(`https://shopee.vn/search?keyword=${encodeURIComponent(product.shopeeKeyword || "")}`, "_blank", "noopener");
    }
  };

  const quickSearch = async (event) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    setError("");
    try {
      const data = await apiRequest("/api/v1/shopping/affiliate-link", {
        method: "POST",
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      window.open(data.buyUrl, "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <aside className="shopping-panel">
      <h2>🛒 Mua sắm trong phim</h2>
      <p className="shopping-hint">
        Thấy món đồ hay trong phim? Bấm quét và <strong>khoanh vùng món đồ</strong> như Google
        Lens — kết quả hiện ngay trên màn hình để bạn chọn mua.
      </p>

      <div className="shopping-actions">
        <button type="button" onClick={onOpenLens}>🔍 Quét đồ vật trên video</button>
        <form onSubmit={quickSearch} className="shopping-search">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Hoặc tìm nhanh: đồng hồ nam..." />
          <button type="submit" className="secondary">Tìm</button>
        </form>
      </div>
      {error && <p className="alert">{error}</p>}

      <h3>Đang xuất hiện ({activeProducts.length})</h3>
      {activeProducts.length === 0 && <p className="shopping-note">Không có sản phẩm nào ở thời điểm này.</p>}
      {activeProducts.map((item) => (
        <div key={item.id} className="shopping-item active">
          <div>
            <strong>{item.productName}</strong>
            {item.category && <small> · {item.category}</small>}
            <small> · giây {item.timestampStart}–{item.timestampEnd}</small>
          </div>
          <button type="button" onClick={() => openBuy(item)}>Mua qua Shopee</button>
        </div>
      ))}

      <h3>Tất cả trong phim ({products.length})</h3>
      {products.map((item) => (
        <div key={item.id} className="shopping-item">
          <div>
            <strong>{item.productName}</strong>
            {item.category && <small> · {item.category}</small>}
          </div>
          <button type="button" className="secondary" onClick={() => openBuy(item)}>Xem</button>
        </div>
      ))}

    </aside>
  );
};

const PlayerPage = () => {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [position, setPosition] = useState(0);
  const videoRef = useRef(null);
  const lastSaved = useRef(0);
  const [lensCard, setLensCard] = useState(null); // { result, photo }
  const [lensOpen, setLensOpen] = useState(false);
  const stageRef = useRef(null);
  // Bật crossOrigin để chụp khung hình cho AI; host video không CORS sẽ fallback tắt nó
  const [videoNoCors, setVideoNoCors] = useState(false);
  useEffect(() => { apiRequest(`/api/v1/episodes/${episodeId}`).then(setEpisode); }, [episodeId]);
  const save = (seconds) => {
    if (Math.abs(seconds - lastSaved.current) < 10) return;
    lastSaved.current = seconds;
    apiRequest(`/api/v1/history/${episodeId}`, { method: "PUT", body: JSON.stringify({ position: seconds }) }).catch(() => {});
  };
  if (!episode) return <main className="page-shell"><p className="empty">Đang tải tập phim...</p></main>;

  // Kết quả CLIP tức thời (backend đo timing riêng từng bước)
  const handleLensResult = (instant, photo) => {
    setLensOpen(false);
    setLensCard({ result: instant, photo });
  };

  // Kéo linh vật thả lên món đồ: crop vùng tròn quanh điểm thả rồi quét CLIP
  const handleMascotScan = async (rect) => {
    setLensOpen(false);
    setLensCard({ result: null, photo: null, aiState: "pending" });
    const cropStart = performance.now();
    let photo = null;
    try {
      try {
        const video = videoRef.current;
        const stage = stageRef.current;
        if (video?.videoWidth && stage) {
          const scaleX = video.videoWidth / stage.clientWidth;
          const scaleY = video.videoHeight / stage.clientHeight;
          const canvas = document.createElement("canvas");
          let w = Math.max(2, Math.round(rect.w * scaleX));
          let h = Math.max(2, Math.round(rect.h * scaleY));
          if (w > 512) { h = Math.round((512 / w) * h); w = 512; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(
            video,
            Math.round(rect.x * scaleX), Math.round(rect.y * scaleY), Math.max(2, Math.round(rect.w * scaleX)), Math.max(2, Math.round(rect.h * scaleY)),
            0, 0, w, h,
          );
          photo = canvas.toDataURL("image/jpeg", 0.7);
        }
      } catch { /* canvas tainted */ }
      const result = await apiRequest("/api/v1/visual-search", {
        method: "POST",
        body: JSON.stringify({
          movieId: episode.production_id, position: Math.floor(position),
          image: photo, cropMs: Math.round(performance.now() - cropStart),
        }),
      });
      setLensCard({ result, photo });
    } catch (e) {
      setLensCard({ result: { message: e.message, products: [] }, photo: null });
    }
  };

  // Mua: backend xác thực sản phẩm + ghi affiliate_clicks + 302 sang sàn
  const buyFromLens = (product) => {
    const searchId = lensCard?.result?.searchId;
    window.open(
      `${API_URL}/api/v1/affiliate/redirect/${product.id}${searchId ? `?searchId=${searchId}` : ""}`,
      "_blank",
      "noopener",
    );
  };

  // Sản phẩm chưa gắn affiliate: mở Shopee search theo tên (tìm kiếm, không phải link hoa hồng)
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
          {lensCard && (
            <LensResult
              result={lensCard.result}
              photo={lensCard.photo}
              aiState={lensCard.aiState}
              onBuy={buyFromLens}
              onFindShopee={findOnShopee}
              onClose={() => setLensCard(null)}
            />
          )}
          <ScanMascot stageRef={stageRef} onScanRegion={handleMascotScan} />
          {lensOpen && (
            <LensOverlay
              episode={episode}
              position={position}
              videoRef={videoRef}
              onClose={() => setLensOpen(false)}
              onResult={handleLensResult}
            />
          )}
        </div>
        <div className="manual-progress">
          <label>Vị trí xem thử: {Math.floor(position)} giây</label>
          <input type="range" min="0" max={episode.duration} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
          <button onClick={() => save(Math.floor(position))}>Lưu vị trí xem</button>
        </div>
      </div>
      <ShoppingPanel episode={episode} position={position} onOpenLens={() => setLensOpen(true)} />
    </main>
  );
};
export default PlayerPage;
