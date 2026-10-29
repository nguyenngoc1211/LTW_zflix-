import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MovieCard from "../../components/MovieCard.jsx";
import { apiRequest } from "../../services/api.js";

const initialFilters = { search: "", genre: "", country: "", year: "", minRating: "", sortYear: "desc" };

const HomePage = () => {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [options, setOptions] = useState({ genres: [], countries: [], years: [] });
  const [result, setResult] = useState({ items: [], page: 1, pages: 1, total: 0 });
  const [featured, setFeatured] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { apiRequest("/api/v1/filters").then(setOptions).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    // Banner phim nổi bật do admin đặt (null nếu chưa đặt)
    apiRequest("/api/v1/settings/featured")
      .then((data) => setFeatured(data.production || null))
      .catch(() => setFeatured(null));
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    query.set("limit", "50");
    apiRequest(`/api/v1/productions?${query}`).then(setResult).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [filters]);

  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  // Autocomplete gợi ý phim khi gõ (Edge NGram-style prefix search)
  const onSearchInput = (event) => {
    const value = event.target.value;
    setDraft((current) => ({ ...current, search: value }));
    clearTimeout(suggestTimer.current);
    if (!value.trim()) { setSuggestions([]); setShowSuggest(false); return; }
    suggestTimer.current = setTimeout(() => {
      apiRequest(`/api/v1/productions/suggest?q=${encodeURIComponent(value.trim())}`)
        .then((data) => { setSuggestions(data.items); setShowSuggest(data.items.length > 0); })
        .catch(() => {});
    }, 250);
  };
  const goSuggestion = (item) => {
    setShowSuggest(false);
    navigate(`/movies/${item.id}`);
  };
  return <>
    {featured ? (
      <section className="hero" style={featured.banner_url ? { backgroundImage: `linear-gradient(90deg, rgba(8,10,15,.95), rgba(8,10,15,.4)), url(${featured.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
        <p className="eyebrow">PHIM NỔI BẬT</p>
        <h1>{featured.title}</h1>
        <p>{featured.description || `${featured.type === "movie" ? "Phim lẻ" : "Phim bộ"} · ${featured.release_year || ""}`}</p>
        <div className="actions"><Link className="button-link" to={`/movies/${featured.id}`}>▶ Xem ngay</Link></div>
      </section>
    ) : (
      <section className="hero"><p className="eyebrow">KHÁM PHÁ KHÔNG GIỚI HẠN</p><h1>Phim hay cho mọi khoảnh khắc.</h1><p>Tìm kiếm không phân biệt hoa thường và kết hợp nhiều bộ lọc cùng lúc.</p></section>
    )}
    <main className="page-shell">
      <form className="filter-panel" onSubmit={(event) => { event.preventDefault(); setLoading(true); setError(""); setFilters(draft); }}>
        <div className="search-row" style={{ position: "relative" }}>
          <input aria-label="Tên phim" value={draft.search} onChange={onSearchInput} placeholder="Nhập tên phim..." autoComplete="off" />
          {showSuggest && suggestions.length > 0 && (
            <div className="suggest-dropdown">
              {suggestions.map((item) => (
                <button key={item.id} type="button" className="suggest-item" onClick={() => goSuggestion(item)}>
                  {item.poster_url ? <img src={item.poster_url} alt="" loading="lazy" /> : <span className="suggest-fallback">🎬</span>}
                  <span className="suggest-title">{item.title}</span>
                  <span className="suggest-year">{item.release_year || ""}</span>
                  <span className="suggest-rating">⭐ {Number(item.rating_avg).toFixed(1)}</span>
                </button>
              ))}
            </div>
          )}
          <button type="submit">Tìm phim</button>
        </div>
        <div className="filter-grid">
          <select value={draft.genre} onChange={update("genre")}><option value="">Mọi thể loại</option>{options.genres.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select>
          <select value={draft.country} onChange={update("country")}><option value="">Mọi quốc gia</option>{options.countries.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={draft.year} onChange={update("year")}><option value="">Mọi năm</option>{options.years.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={draft.minRating} onChange={update("minRating")}><option value="">Mọi điểm số</option><option value="4">Từ 4 sao</option><option value="3">Từ 3 sao</option></select>
          <select value={draft.sortYear} onChange={update("sortYear")}><option value="desc">Năm mới nhất</option><option value="asc">Năm cũ nhất</option></select>
          <button type="button" className="secondary" onClick={() => { setDraft(initialFilters); setLoading(true); setError(""); setFilters(initialFilters); }}>Xóa lọc</button>
        </div>
      </form>
      <div className="section-title"><h2>Kho phim</h2><span>{loading ? "Đang tải..." : `${result.total} kết quả`}</span></div>
      {error && <p className="alert">{error}</p>}
      {loading ? <p className="empty">Đang tải phim...</p> : result.items.length ? <div className="movie-grid">{result.items.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div> : <p className="empty">Không tìm thấy phim phù hợp.</p>}
    </main>
  </>;
};

export default HomePage;
