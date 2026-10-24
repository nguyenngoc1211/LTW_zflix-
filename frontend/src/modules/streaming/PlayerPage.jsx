import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

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
    try {
      let photo = null;
      // Crop vùng đã khoanh từ frame hiện tại (nếu canvas không bị CORS taint)
      try {
        const video = videoRef.current;
        const container = containerRef.current;
        if (video?.videoWidth && rect && rect.w > 8 && rect.h > 8) {
          const scaleX = video.videoWidth / container.clientWidth;
          const scaleY = video.videoHeight / container.clientHeight;
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(2, Math.round(rect.w * scaleX));
          canvas.height = Math.max(2, Math.round(rect.h * scaleY));
          canvas
            .getContext("2d")
            .drawImage(video, Math.round(rect.x * scaleX), Math.round(rect.y * scaleY), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          photo = canvas.toDataURL("image/jpeg", 0.75);
        }
      } catch {
        // video domain khác làm canvas tainted — vẫn quét theo thời điểm
      }
      const result = await apiRequest("/api/v1/shopping/match", {
        method: "POST",
        body: JSON.stringify({ episodeId: episode.id, position: Math.floor(position), photo }),
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

const formatVnd = (raw) => {
  const vnd = Math.round(Number(raw || 0) / 100000);
  return vnd > 0 ? new Intl.NumberFormat("vi-VN").format(vnd) + "₫" : null;
};

// ---------------------------------------------------------------------------
// Thẻ kết quả quét hiện ngay trên video
// ---------------------------------------------------------------------------
const LensResult = ({ result, photo, onBuy, onBuyShopeeItem, onClose }) => {
  const items = result.items || [];
  const shopeeItems = result.shopeeItems || [];
  return (
    <div className="lens-result">
      <div className="lens-result-head">
        <strong>{items.length > 0 ? `Tìm thấy ${items.length} món đồ` : "Không nhận diện được món đồ"}</strong>
        <button type="button" className="lens-close" onClick={onClose}>✕</button>
      </div>
      {photo && <img className="lens-result-photo" src={photo} alt="Vùng đã quét" />}
      {items.length === 0 && <p className="lens-result-note">{result.note || "Thử khoanh vùng khác hoặc tìm theo từ khoá."}</p>}
      {items.map((item) => (
        <div key={item.id} className="lens-product-card">
          <div className="lens-product-info">
            <strong>{item.productName}</strong>
            {item.category && <small>{item.category}</small>}
          </div>
          <button type="button" onClick={() => onBuy(item)}>Mua qua Shopee</button>
        </div>
      ))}
      {shopeeItems.length > 0 && <p className="lens-shopee-head">Gợi ý từ Shopee</p>}
      {shopeeItems.map((item) => (
        <div key={`${item.itemId}-${item.shopId}`} className="lens-product-card shopee-item">
          {item.imageUrl && <img className="lens-item-img" src={item.imageUrl} alt="" loading="lazy" />}
          <div className="lens-product-info">
            <strong>{item.name}</strong>
            <small>
              {formatVnd(item.price)}
              {item.commissionRate != null ? ` · HH ${Number(item.commissionRate).toFixed(1)}%` : ""}
              {item.sales != null ? ` · ${item.sales} đã bán` : ""}
            </small>
          </div>
          <button type="button" onClick={() => onBuyShopeeItem(item)}>Mua</button>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Panel mua sắm bên cạnh player
// ---------------------------------------------------------------------------
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
  useEffect(() => { apiRequest(`/api/v1/episodes/${episodeId}`).then(setEpisode); }, [episodeId]);
  const save = (seconds) => {
    if (Math.abs(seconds - lastSaved.current) < 10) return;
    lastSaved.current = seconds;
    apiRequest(`/api/v1/history/${episodeId}`, { method: "PUT", body: JSON.stringify({ position: seconds }) }).catch(() => {});
  };
  if (!episode) return <main className="page-shell"><p className="empty">Đang tải tập phim...</p></main>;

  // Mua sản phẩm Shopee thật (kết quả Open API): short link lúc click
  const buyShopeeItem = async (item) => {
    try {
      const data = await apiRequest("/api/v1/shopping/shopee/buy-link", { method: "POST", body: JSON.stringify({ itemUrl: item.itemUrl }) });
      window.open(data.buyUrl, "_blank", "noopener");
    } catch {
      window.open(item.itemUrl, "_blank", "noopener");
    }
  };

  // Bấm mua từ thẻ kết quả quét: tạo affiliate link tại thời điểm này
  const buyFromLens = async (product) => {
    try {
      const data = await apiRequest(`/api/v1/shopping/products/${product.id}/buy`, { method: "POST" });
      window.open(data.buyUrl, "_blank", "noopener");
    } catch {
      window.open(`https://shopee.vn/search?keyword=${encodeURIComponent(product.shopeeKeyword || "")}`, "_blank", "noopener");
    }
  };

  return (
    <main className="page-shell player-page">
      <div className="player-main">
        <Link to={`/movies/${episode.production_id}`}>← {episode.production_title}</Link>
        <h1>Tập {episode.episode_number}: {episode.title}</h1>
        <div className="player-stage">
          {episode.video_url ? (
            <video ref={videoRef} controls autoPlay src={episode.video_url} onTimeUpdate={(e) => { setPosition(e.currentTarget.currentTime); save(Math.floor(e.currentTarget.currentTime)); }} onPause={(e) => save(Math.floor(e.currentTarget.currentTime))} />
          ) : (
            <div className="video-placeholder"><span>▶</span><p>Chưa có URL video trong dữ liệu mẫu.</p></div>
          )}
          {lensCard && (
            <LensResult
              result={lensCard.result}
              photo={lensCard.photo}
              onBuy={buyFromLens}
              onBuyShopeeItem={buyShopeeItem}
              onClose={() => setLensCard(null)}
            />
          )}
          {lensOpen && (
            <LensOverlay
              episode={episode}
              position={position}
              videoRef={videoRef}
              onClose={() => setLensOpen(false)}
              onResult={(result, photo) => {
                setLensCard({ result, photo });
                setLensOpen(false);
              }}
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
