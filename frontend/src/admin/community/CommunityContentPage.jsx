import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import AdminBroadcastForm from './AdminBroadcastForm.jsx';
import AdminPostsPanel from './AdminPostsPanel.jsx';
import AdminMoviePanel from './AdminMoviePanel.jsx';
import AdminModal from '../ui/AdminModal.jsx';
import './admin-content.css';

export default function CommunityContentPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const view = params.get('view') === 'movies' || ['comments', 'ratings'].includes(params.get('view')) ? 'movies' : 'posts';
  const choose = (next) => setParams(next === 'posts' ? {} : { view: 'movies' });
  return <div className="admin-content-space"><header className="admin-content-top"><div><span className="admin-content-eyebrow">CONTENT MANAGEMENT</span><h2>Trung tâm nội dung</h2><p>Bài viết cộng đồng và thảo luận theo từng phim, trong cùng một quy trình kiểm duyệt.</p></div>{user?.role === 'admin' && <button className="admin-content-notify" onClick={() => setBroadcastOpen(true)}>Gửi thông báo hệ thống</button>}</header><nav className="admin-content-switch" aria-label="Loại nội dung">{[['posts', 'Bài viết'], ['movies', 'Phim']].map(([key, label]) => <button key={key} className={view === key ? 'is-active' : ''} onClick={() => choose(key)}>{label}</button>)}</nav>
    {view === 'posts' ? <AdminPostsPanel /> : <AdminMoviePanel />}
    {broadcastOpen && <AdminModal title="Gửi thông báo hệ thống" onClose={() => setBroadcastOpen(false)}><AdminBroadcastForm /></AdminModal>}
  </div>;
}
