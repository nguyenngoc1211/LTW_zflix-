import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const ShoppingPanel = ({ episode, position, videoRef }) => {
  const [products, setProducts] = useState([]);
  const [snapshotResult, setSnapshotResult] = useState(null);
  const [snapshotImage, setSnapshotImage] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Danh sách sản phẩm của phim (public)
  useEffect(() => {
    apiRequest(`/api/v1/shopping/productions/${episode.production_id}/products`)
      .then((data) => setProducts(data.items))
      .catch(() => {});
  }, [episode.production_id]);

  // Sản phẩm đúng thời điểm hiện tại
  const activeProducts = products.filter(
    (item) => position >= item.timestampStart && position <= item.timestampEnd,
  );

  // Chụp khung hình hiện tại rồi gửi lên server match theo thời điểm
  const capture = async () => {
    setError("");
    setBusy(true);
    try {
      let photo = null;
      // Video domain khác có thể làm canvas tainted (CORS) — chụp thất bại thì vẫn match theo thời điểm
      try {
        const video = videoRef.current;
        if (video && video.videoWidth) {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(video.videoWidth, 640);
          canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          photo = canvas.toDataURL("image/jpeg", 0.7);
          setSnapshotImage(photo);
        }
      } catch {
        setSnapshotImage(null);
      }
      const result = await apiRequest("/api/v1/shopping/match", {
        method: "POST",
        body: JSON.stringify({ episodeId: episode.id, position: Math.floor(position), photo, keyword: "" }),
      });
      setSnapshotResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const quickSearch = async (event) => {
    event.preventDefault();
    if (!keyword.trim()) return;
    setError("");
    try {
      const result = await apiRequest("/api/v1/shopping/match", {
        method: "POST",
        body: JSON.stringify({ episodeId: episode.id, position: Math.floor(position), keyword: keyword.trim() }),
      });
      setSnapshotResult(result);
    } catch (e) {
      setError(e.message);
    }
  };

  const openBuy = async (product) => {
    try {
      await apiRequest(`/api/v1/shopping/products/${product.id}/click`, { method: "POST" });
    } catch {
      // vẫn mở link kể cả khi không ghi được thống kê
    }
    window.open(product.shopeeUrl, "_blank", "noopener");
  };

  const openUrl = (url) => window.open(url, "_blank", "noopener");

  return (
    <aside className="shopping-panel">
      <h2>🛒 Mua sắm trong phim</h2>
      <p className="shopping-hint">Thấy món đồ hay? Chụp khung hình để tìm sản phẩm đang xuất hiện, hoặc tìm nhanh theo từ khoá.</p>

      <div className="shopping-actions">
        <button type="button" onClick={capture} disabled={busy}>
          {busy ? "Đang xử lý..." : "📸 Chụp khung hình"}
        </button>
        <form onSubmit={quickSearch} className="shopping-search">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Ví dụ: đồng hồ nam..." />
          <button type="submit" className="secondary">Tìm Shopee</button>
        </form>
      </div>
      {error && <p className="alert">{error}</p>}

      {snapshotImage && <img className="shopping-snapshot" src={snapshotImage} alt="Khung hình vừa chụp" />}
      {snapshotResult && (
        <div className="shopping-result">
          {snapshotResult.items?.length > 0 ? (
            <>
              <p className="shopping-found">Tìm thấy {snapshotResult.items.length} sản phẩm ở giây {snapshotResult.position}:</p>
              {snapshotResult.items.map((item) => (
                <div key={item.id} className="shopping-item">
                  <div>
                    <strong>{item.productName}</strong>
                    {item.category && <small> · {item.category}</small>}
                  </div>
                  <button type="button" onClick={() => openBuy(item)}>Mua trên Shopee</button>
                </div>
              ))}
            </>
          ) : (
            <p className="shopping-note">{snapshotResult.note}</p>
          )}
          {snapshotResult.quickSearch && (
            <div className="shopping-item">
              <div><strong>Tìm nhanh: “{snapshotResult.quickSearch.keyword}”</strong></div>
              <button type="button" onClick={() => openUrl(snapshotResult.quickSearch.shopeeUrl)}>Mở Shopee</button>
            </div>
          )}
        </div>
      )}

      <h3>Đang xuất hiện ({activeProducts.length})</h3>
      {activeProducts.length === 0 && <p className="shopping-note">Không có sản phẩm nào được gắn ở thời điểm này.</p>}
      {activeProducts.map((item) => (
        <div key={item.id} className="shopping-item active">
          <div>
            <strong>{item.productName}</strong>
            {item.category && <small> · {item.category}</small>}
            <small> · giây {item.timestampStart}–{item.timestampEnd}</small>
          </div>
          <button type="button" onClick={() => openBuy(item)}>Mua trên Shopee</button>
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
  useEffect(() => { apiRequest(`/api/v1/episodes/${episodeId}`).then(setEpisode); }, [episodeId]);
  const save = (seconds) => {
    if (Math.abs(seconds - lastSaved.current) < 10) return;
    lastSaved.current = seconds;
    apiRequest(`/api/v1/history/${episodeId}`, { method: "PUT", body: JSON.stringify({ position: seconds }) }).catch(() => {});
  };
  if (!episode) return <main className="page-shell"><p className="empty">Đang tải tập phim...</p></main>;
  return (
    <main className="page-shell player-page">
      <div className="player-main">
        <Link to={`/movies/${episode.production_id}`}>← {episode.production_title}</Link>
        <h1>Tập {episode.episode_number}: {episode.title}</h1>
        {episode.video_url ? (
          <video ref={videoRef} controls autoPlay src={episode.video_url} onTimeUpdate={(e) => { setPosition(e.currentTarget.currentTime); save(Math.floor(e.currentTarget.currentTime)); }} onPause={(e) => save(Math.floor(e.currentTarget.currentTime))} />
        ) : (
          <div className="video-placeholder"><span>▶</span><p>Chưa có URL video trong dữ liệu mẫu.</p></div>
        )}
        <div className="manual-progress">
          <label>Vị trí xem thử: {Math.floor(position)} giây</label>
          <input type="range" min="0" max={episode.duration} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
          <button onClick={() => save(Math.floor(position))}>Lưu vị trí xem</button>
        </div>
      </div>
      <ShoppingPanel episode={episode} position={position} videoRef={videoRef} />
    </main>
  );
};
export default PlayerPage;
