import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { ProConfigProvider, viVNIntl } from '@ant-design/pro-components';
import viVN from 'antd/locale/vi_VN';
import { AppstoreOutlined, BarChartOutlined, ExceptionOutlined, LogoutOutlined, MenuOutlined, SafetyOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth.js';
import './admin-shell.css';

const sectionLabels = { content: 'Kho phim & tập', parties: 'Watch Party', views: 'Thống kê lượt xem', security: 'Nhật ký bảo mật', settings: 'Cài đặt hệ thống' };
const links = [
  { to: '/admin/community-hub', label: 'Quản lý cộng đồng', icon: TeamOutlined, hub: true },
  { to: '/admin/content', label: 'Kho phim & tập', icon: AppstoreOutlined },
  { to: '/admin/parties', label: 'Watch Party', icon: ExceptionOutlined },
  { to: '/admin/views', label: 'Thống kê lượt xem', icon: BarChartOutlined },
  { to: '/admin/security', label: 'Nhật ký bảo mật', icon: SafetyOutlined, adminOnly: true },
  { to: '/admin/settings', label: 'Cài đặt hệ thống', icon: SettingOutlined, adminOnly: true },
];

export default function AdminPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessStatus, setAccessStatus] = useState('checking');
  const { user, logout, apiRequest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    let active = true;
    apiRequest('/api/v1/admin/check').then(() => { if (active) setAccessStatus('allowed'); }).catch((error) => { if (active) setAccessStatus(error.status === 403 ? 'denied' : 'error'); });
    return () => { active = false; };
  }, [apiRequest]);
  const current = location.pathname.split('/')[2] || 'community-hub';
  const title = current === 'community-hub' ? 'Trung tâm quản lý cộng đồng' : sectionLabels[current] || 'ZFLIX Admin';
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  if (accessStatus !== 'allowed') return <main className="zadmin-gate"><div><strong>ZFLIX ADMIN</strong><h1>{accessStatus === 'checking' ? 'Đang kiểm tra quyền quản trị...' : accessStatus === 'denied' ? 'Không có quyền quản trị' : 'Không thể xác minh quyền quản trị'}</h1><a href="/">Về trang chủ</a></div></main>;
  return <ConfigProvider locale={viVN} theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#E50914', colorBgBase: '#0B0F17', borderRadius: 9 } }}><ProConfigProvider intl={viVNIntl}>
    <div className="zadmin">
      {menuOpen && <button className="zadmin-overlay" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`zadmin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="zadmin-brand"><span className="zadmin-brand-mark">Z</span><div><strong>ZFLIX</strong><small>ADMIN CONSOLE</small></div></div>
        <div className="zadmin-nav-label">KHÔNG GIAN QUẢN TRỊ</div>
        <nav aria-label="Điều hướng quản trị">{links.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => <NavLink key={item.to} to={item.to} end={!item.hub} onClick={() => setMenuOpen(false)} className={({ isActive }) => `zadmin-nav-item ${isActive || (item.hub && current === 'community-hub') ? 'is-active' : ''}`}><item.icon /><span>{item.label}</span>{item.hub && <b>01</b>}</NavLink>)}</nav>
        <div className="zadmin-sidebar-foot"><span className="zadmin-online" /> Hệ thống quản trị</div>
      </aside>
      <div className="zadmin-body"><header className="zadmin-topbar"><div className="zadmin-topbar-left"><button className="zadmin-menu-button" aria-label="Mở menu" onClick={() => setMenuOpen(true)}><MenuOutlined /></button><span className="zadmin-breadcrumb">QUẢN TRỊ / <b>{title}</b></span></div><div className="zadmin-user"><span className="zadmin-user-avatar">{user?.username?.slice(0, 1).toUpperCase()}</span><span><strong>{user?.username}</strong><small>{user?.role === 'admin' ? 'Quản trị viên' : 'Điều hành viên'}</small></span><button onClick={signOut} title="Đăng xuất" aria-label="Đăng xuất"><LogoutOutlined /></button></div></header><div className="zadmin-content"><Outlet /></div></div>
    </div>
  </ProConfigProvider></ConfigProvider>;
}
