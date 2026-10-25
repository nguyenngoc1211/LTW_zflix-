// Panel kết quả CineLens — glassmorphism, drawer bên phải (desktop) / bottom sheet (mobile)
export default function ProductPanel({ result, photo, onClose, onBuy, onFind }) {
  const items = result.products || [];
  const mode = result.mode === "real" ? "REAL" : "DEMO";
  const formatVnd = (raw) => (raw ? new Intl.NumberFormat("vi-VN").format(Number(raw)) + "₫" : null);

  return (
    <aside className="cinelens-panel" role="dialog" aria-label="Kết quả tìm kiếm Lensy">
      <div className="cinelens-panel-head">
        <div>
          <h3>Lensy tìm thấy {items.length} sản phẩm</h3>
          <span className="cinelens-mode-badge" data-mode={mode}>{mode === "real" ? "REAL DATA" : "DEMO CATALOG"}</span>
        </div>
        <button type="button" className="cinelens-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>

      {photo && <img className="cinelens-photo" src={photo} alt="Vùng bạn đã khoanh" />}
      {result.ocrText && <p className="cinelens-ocr">📜 Lensy đọc được chữ: “{result.ocrText}”</p>}
      {result.detected_objects?.map((obj, index) => (
        <p key={index} className="lens-ai-badge">🤖 Nhận diện: “{obj.name}”{obj.source === "ocr" ? " (OCR)" : ""}</p>
      ))}

      {items.length === 0 && (
        <p className="cinelens-empty">{result.message || "Chưa tìm thấy sản phẩm phù hợp — thử khoanh vùng rõ hơn nhé!"}</p>
      )}

      <div className="cinelens-products">
        {items.map((product) => (
          <article key={product.id} className="cinelens-card">
            <img className="cinelens-card-img" src={product.image} alt="" loading="lazy" />
            <div className="cinelens-card-body">
              <strong>{product.name}</strong>
              {product.category && <small>{product.category}</small>}
              <p className="cinelens-card-meta">
                {product.price ? formatVnd(product.price) : "Giá liên hệ"}
                {product.similarity != null ? ` · giống ${(product.similarity * 100).toFixed(0)}%` : ""}
              </p>
              <small className="cinelens-card-market">{product.platform}</small>
            </div>
            <button
              type="button"
              className={product.hasAffiliate ? "cinelens-buy" : "cinelens-find"}
              onClick={() => (product.hasAffiliate ? onBuy(product) : onFind(product))}
            >
              {product.hasAffiliate ? "Mua ngay" : "Tìm trên Shopee"}
            </button>
          </article>
        ))}
      </div>

      <p className="cinelens-footer-note">
        {mode === "demo"
          ? "⚠️ Chế độ DEMO — sản phẩm từ Local Catalog mẫu, chưa liên kết sàn thật."
          : "🔗 Chế độ REAL — đang dùng nguồn dữ liệu đã cấu hình."}
        {result.timings ? ` ⚡ ${result.timings.totalMs}ms` : ""}
      </p>
    </aside>
  );
}
