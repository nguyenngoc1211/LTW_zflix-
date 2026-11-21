import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import './community-hub.css';

const tabs = [
  { path: '', label: 'Tổng quan', eyebrow: '01' },
  { path: 'content', label: 'Nội dung', eyebrow: '02' },
  { path: 'users', label: 'Người dùng', eyebrow: '03', adminOnly: true },
  { path: 'moderation', label: 'Kiểm duyệt', eyebrow: '04', adminOnly: true },
  { path: 'points', label: 'Points', eyebrow: '05', adminOnly: true },
  { path: 'quests', label: 'Nhiệm vụ & Huy hiệu', eyebrow: '06', adminOnly: true },
  { path: 'vip', label: 'VIP & Doanh thu', eyebrow: '07' },
];
export default function CommunityHubLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const segment = location.pathname.split('/')[3];
  const active = tabs.find((tab) => tab.path === (segment || '')) || tabs[0];
  return <div className="admin-hub"><div className="admin-hub-intro"><div><span>TRUNG TÂM QUẢN LÝ / ZFLIX</span><h1>Quản lý cộng đồng</h1><p>Một nơi cho nội dung, người dùng, kiểm duyệt, điểm và VIP.</p></div><div className="admin-hub-mode"><i />{user?.role === 'admin' ? 'ADMIN ACCESS' : 'MODERATOR ACCESS'}</div></div>
    <nav className="admin-hub-tabs" aria-label="Mục quản lý cộng đồng">{tabs.filter((tab) => !tab.adminOnly || user?.role === 'admin').map((tab) => <NavLink key={tab.path} end to={`/admin/community-hub${tab.path ? `/${tab.path}` : ''}`} className={({ isActive }) => `admin-hub-tab ${isActive ? 'is-active' : ''}`}><small>{tab.eyebrow}</small>{tab.label}</NavLink>)}</nav>
    <div className="admin-hub-section"><div className="admin-hub-section-title"><span>{active.eyebrow} / QUẢN LÝ CỘNG ĐỒNG</span><strong>{active.label}</strong></div><Outlet /></div>
  </div>;
}
