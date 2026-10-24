import { useEffect, useState } from "react";
import MovieCard from "../../components/MovieCard.jsx";
import { apiRequest } from "../../services/api.js";

const LibraryPage = () => {
  const [tab, setTab] = useState("favorites");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const load = () => apiRequest(`/api/v1/${tab}`).then((data) => { setItems(data.items); setError(""); }).catch((e) => setError(e.status === 503 ? "Hãy merge branch Du và đăng nhập để dùng thư viện cá nhân." : e.message));
  useEffect(() => { load(); }, [tab]);
  const remove = async (id) => { await apiRequest(`/api/v1/${tab}/${id}`, { method: "DELETE" }); load(); };
  return <main className="page-shell"><div className="section-title"><h1>Thư viện của tôi</h1></div><div className="tabs"><button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>Yêu thích</button><button className={tab === "interests" ? "active" : ""} onClick={() => setTab("interests")}>Đang quan tâm</button></div>{error && <p className="alert">{error}</p>}<div className="movie-grid">{items.map((movie) => <div key={movie.id}><MovieCard movie={movie} /><button className="text-button" onClick={() => remove(movie.id)}>Xóa khỏi danh sách</button></div>)}</div></main>;
};
export default LibraryPage;
