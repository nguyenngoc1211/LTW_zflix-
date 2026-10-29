import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

// Chỉ gợi ý xem tiếp khi tập chưa xong và vị trí lưu còn hợp lệ với thời lượng hiện tại.
const resumePosition = (item) => {
  const position = Number(item.last_position);
  const duration = Number(item.duration);
  if (item.is_completed || !(position > 0) || !(duration > 0)) return null;
  if (position >= duration - 5) return null;
  return Math.floor(position);
};

const HistoryPage = () => {
  const [items, setItems] = useState([]); const [error, setError] = useState("");
  const load = () => apiRequest("/api/v1/history").then((data) => setItems(data.items)).catch((e) => setError(e.status === 503 ? "Hãy merge branch Du và đăng nhập để xem lịch sử." : e.message));
  useEffect(() => { load(); }, []);
  return <main className="page-shell"><div className="section-title"><h1>Lịch sử xem</h1>{items.length > 0 && <button className="secondary" onClick={async () => { await apiRequest("/api/v1/history", { method: "DELETE" }); load(); }}>Xóa tất cả</button>}</div>{error && <p className="alert">{error}</p>}<div className="history-list">{items.map((item) => { const position = resumePosition(item); return <article key={item.episode_id}><div><h3>{item.title}</h3><p>Tập {item.episode_number}: {item.episode_title}</p><progress max="100" value={Number(item.watched_percent)} /><small>{Math.round(item.watched_percent)}% · xem gần nhất {new Date(item.last_watched_at).toLocaleString("vi-VN")}</small></div><div className="history-actions"><Link className="button-link" to={`/watch-episode/${item.episode_id}${position === null ? "" : `?pos=${position}`}`}>Xem tiếp</Link><button className="text-button" onClick={async () => { await apiRequest(`/api/v1/history/${item.episode_id}`, { method: "DELETE" }); load(); }}>Xóa</button></div></article>; })}</div></main>;
};
export default HistoryPage;
