import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const NotificationsPage = () => {
  const [data, setData] = useState({ items: [], unread: 0 }); const [error, setError] = useState("");
  const load = () => apiRequest("/api/v1/notifications").then(setData).catch((e) => setError(e.status === 503 ? "Hãy merge branch Du và đăng nhập để nhận thông báo." : e.message));
  useEffect(load, []);
  return <main className="page-shell"><div className="section-title"><h1>Thông báo <span className="badge">{data.unread}</span></h1>{data.unread > 0 && <button onClick={async () => { await apiRequest("/api/v1/notifications/read-all", { method: "PATCH" }); load(); }}>Đánh dấu đã đọc</button>}</div>{error && <p className="alert">{error}</p>}<div className="notification-list">{data.items.map((item) => <article key={item.id} className={item.is_read ? "" : "unread"}><div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("vi-VN")}</small></div>{item.redirect_url && <Link to={item.redirect_url}>Mở</Link>}</article>)}</div></main>;
};
export default NotificationsPage;
