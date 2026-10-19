import { useEffect, useState } from "react";
import MovieCard from "../../components/MovieCard.jsx";
import { apiRequest } from "../../services/api.js";

const initialFilters = { search: "", genre: "", country: "", year: "", minRating: "", sortYear: "desc" };

const HomePage = () => {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [options, setOptions] = useState({ genres: [], countries: [], years: [] });
  const [result, setResult] = useState({ items: [], page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { apiRequest("/api/v1/filters").then(setOptions).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    apiRequest(`/api/v1/productions?${query}`).then(setResult).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [filters]);

  const update = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  return <>
    <section className="hero"><p className="eyebrow">KHÁM PHÁ KHÔNG GIỚI HẠN</p><h1>Phim hay cho mọi khoảnh khắc.</h1><p>Tìm kiếm không phân biệt hoa thường và kết hợp nhiều bộ lọc cùng lúc.</p></section>
    <main className="page-shell">
      <form className="filter-panel" onSubmit={(event) => { event.preventDefault(); setLoading(true); setError(""); setFilters(draft); }}>
        <div className="search-row"><input aria-label="Tên phim" value={draft.search} onChange={update("search")} placeholder="Nhập tên phim..." /><button type="submit">Tìm phim</button></div>
        <div className="filter-grid">
          <select value={draft.genre} onChange={update("genre")}><option value="">Mọi thể loại</option>{options.genres.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select>
          <select value={draft.country} onChange={update("country")}><option value="">Mọi quốc gia</option>{options.countries.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={draft.year} onChange={update("year")}><option value="">Mọi năm</option>{options.years.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={draft.minRating} onChange={update("minRating")}><option value="">Mọi điểm số</option><option value="4">Từ 4 sao</option><option value="3">Từ 3 sao</option></select>
          <select value={draft.sortYear} onChange={update("sortYear")}><option value="desc">Năm mới nhất</option><option value="asc">Năm cũ nhất</option></select>
          <button type="button" className="secondary" onClick={() => { setDraft(initialFilters); setLoading(true); setError(""); setFilters(initialFilters); }}>Xóa lọc</button>
        </div>
      </form>
      <div className="section-title"><h2>Kho phim</h2><span>{result.total} kết quả</span></div>
      {error && <p className="alert">{error}</p>}
      {loading ? <p className="empty">Đang tải phim...</p> : result.items.length ? <div className="movie-grid">{result.items.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div> : <p className="empty">Không tìm thấy phim phù hợp.</p>}
    </main>
  </>;
};

export default HomePage;
