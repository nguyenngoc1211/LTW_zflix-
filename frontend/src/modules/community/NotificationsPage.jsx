import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { notificationTime } from '../../utils/notificationTime.js';
import { notificationIcon } from '../../utils/notificationIcon.js';

const filters = [['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['movie', 'Phim'], ['comment', 'Bình luận'], ['system', 'Hệ thống']];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], unread: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiRequest(`/api/v1/notifications?page=${page}&limit=20&filter=${filter}`)); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filter, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener('notifications:socket', load);
    return () => window.removeEventListener('notifications:socket', load);
  }, [load]);
  const open = async (item) => {
    try { if (!item.is_read) { await apiRequest(`/api/v1/notifications/${item.id}/read`, { method: 'PATCH' }); window.dispatchEvent(new Event('notifications:changed')); } }
    catch (err) { setError(err.message); return; }
    if (item.redirect_url?.startsWith('/')) navigate(item.redirect_url);
    else load();
  };
  const remove = async (item) => {
    try { await apiRequest(`/api/v1/notifications/${item.id}`, { method: 'DELETE' }); window.dispatchEvent(new Event('notifications:changed')); load(); }
    catch (err) { setError(err.message); }
  };
  return <main className="page-shell">
    <div className="section-title"><h1>Thông báo <span className="badge">{data.unread}</span></h1>
      {data.unread > 0 && <button type="button" onClick={async () => { try { await apiRequest('/api/v1/notifications/read-all', { method: 'PATCH' }); window.dispatchEvent(new Event('notifications:changed')); load(); } catch (err) { setError(err.message); } }}>Đánh dấu tất cả đã đọc</button>}</div>
    <div className="notification-filters">{filters.map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(1); }}>{label}</button>)}</div>
    {error && <p className="alert" role="alert">{error} <button type="button" onClick={load}>Thử lại</button></p>}
    {loading ? <p>Đang tải thông báo...</p> : !data.items.length ? <p>Chưa có thông báo trong mục này.</p> : <div className="notification-list">{data.items.map((item) => <article key={item.id} className={item.is_read ? '' : 'unread'}>
      {(item.metadata?.actorAvatar || item.metadata?.posterUrl) && <img className="notification-image" src={item.metadata.actorAvatar || item.metadata.posterUrl} alt="" />}
      {!item.metadata?.actorAvatar && !item.metadata?.posterUrl && <span className="notification-type-icon" aria-hidden="true">{notificationIcon(item.type)}</span>}
      <button type="button" className="notification-content" onClick={() => open(item)}><strong>{item.title}</strong><p>{item.message}</p><small>{notificationTime(item.created_at)}</small></button>
      <button type="button" aria-label="Xóa thông báo" onClick={() => remove(item)}>×</button>
    </article>)}</div>}
    <div className="notification-pagination"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button type="button" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>Trang sau</button></div>
  </main>;
}
