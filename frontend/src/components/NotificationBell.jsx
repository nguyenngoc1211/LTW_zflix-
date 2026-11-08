import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_URL, apiRequest, getAccessToken, refreshSession } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';
import { notificationTime } from '../utils/notificationTime.js';
import { notificationIcon } from '../utils/notificationIcon.js';

export default function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    const refresh = () => Promise.all([
      apiRequest('/api/v1/notifications?limit=8'),
      apiRequest('/api/v1/notifications/unread-count'),
    ]).then(([list, count]) => { if (active) { setItems(list.items); setUnread(count.unread); setError(''); } })
      .catch((err) => { if (active) setError(err.message); });
    refresh();
    const socket = io(`${API_URL}/notifications`, { withCredentials: true,
      transports: ['websocket', 'polling'], auth: (callback) => callback({ token: getAccessToken() || '' }) });
    let refreshedSocketToken = false;
    socket.on('connect', refresh);
    const onSocketNotification = () => { refresh(); window.dispatchEvent(new Event('notifications:socket')); };
    socket.on('notification:new', onSocketNotification);
    socket.on('notification:changed', onSocketNotification);
    socket.on('connect_error', async () => {
      if (refreshedSocketToken) return;
      refreshedSocketToken = true;
      try { await refreshSession(); if (active) socket.connect(); } catch { /* API fallback remains available. */ }
    });
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('notifications:changed', onFocus);
    return () => { active = false; socket.disconnect(); window.removeEventListener('focus', onFocus); window.removeEventListener('notifications:changed', onFocus); };
  }, [userId]);
  if (!user) return null;
  const openItem = async (item) => {
    try { if (!item.is_read) await apiRequest(`/api/v1/notifications/${item.id}/read`, { method: 'PATCH' }); }
    catch { setError('Không thể đánh dấu đã đọc.'); return; }
    setOpen(false);
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: 1 } : entry));
    setUnread((count) => Math.max(0, count - (item.is_read ? 0 : 1)));
    if (item.redirect_url?.startsWith('/')) navigate(item.redirect_url);
  };
  return <div className="notification-bell">
    <button type="button" aria-label="Thông báo" aria-expanded={open} onClick={() => setOpen(!open)}>🔔 {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}</button>
    {open && <div className="notification-dropdown">
      <div className="notification-dropdown-heading"><strong>Thông báo</strong><button type="button" onClick={async () => { await apiRequest('/api/v1/notifications/read-all', { method: 'PATCH' }); setUnread(0); setItems((current) => current.map((item) => ({ ...item, is_read: 1 }))); }}>Đánh dấu tất cả đã đọc</button></div>
      {error && <p role="alert">{error}</p>}
      {!items.length && <p>Chưa có thông báo.</p>}
      {items.map((item) => <button type="button" key={item.id} className={item.is_read ? 'notification-preview' : 'notification-preview unread'} onClick={() => openItem(item)}>
        {item.metadata?.actorAvatar && <img src={item.metadata.actorAvatar} alt="" />}
        {!item.metadata?.actorAvatar && item.metadata?.posterUrl && <img src={item.metadata.posterUrl} alt="" />}
        {!item.metadata?.actorAvatar && !item.metadata?.posterUrl && <span className="notification-type-icon" aria-hidden="true">{notificationIcon(item.type)}</span>}
        <span><strong>{item.title}</strong><small>{item.message}</small><small>{notificationTime(item.created_at)}</small></span>
      </button>)}
      <Link to="/notifications" onClick={() => setOpen(false)}>Xem tất cả thông báo</Link>
    </div>}
  </div>;
}
