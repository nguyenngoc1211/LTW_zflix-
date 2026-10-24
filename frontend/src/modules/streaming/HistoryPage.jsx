import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const HistoryPage = () => {
  const [items, setItems] = useState([]); const [error, setError] = useState("");
  const load = () => apiRequest("/api/v1/history").then((data) => setItems(data.items)).catch((e) => setError(e.status === 503 ? "Hãy merge branch Du và đăng nhập để xem lịch sử." : e.message));
  useEffect(() => { load(); }, []);
  return <main className="page-shell"><div className="section-title"><h1>Lịch sử xem</h1>{items.length > 0 && <button className="secondary" onClick={async () => { await apiRequest("/api/v1/history", { method: "DELETE" }); load(); }}>Xóa tất cả</button>}</div>{error && <p className="alert">{error}</p>}<div className="history-list">{items.map((item) => <article key={item.episode_id}><div><h3>{item.title}</h3><p>Tập {item.episode_number}: {item.episode_title}</p><progress max="100" value={Number(item.watched_percent)} /><small>{Math.round(item.watched_percent)}% · xem gần nhất {new Date(item.last_watched_at).toLocaleString("vi-VN")}</small></div><div><Link className="button-link" to={`/watch/${item.episode_id}`}>Xem tiếp</Link><button className="text-button" onClick={async () => { await apiRequest(`/api/v1/history/${item.episode_id}`, { method: "DELETE" }); load(); }}>Xóa</button></div></article>)}</div></main>;
};
export default HistoryPage;
