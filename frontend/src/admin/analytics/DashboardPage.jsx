import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import './dashboard.css';

const number = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0));
const money = (value) => `${number(value)} ₫`;
export default function DashboardPage() {
  const { apiRequest, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const calls = [apiRequest('/api/v1/admin/stats'), apiRequest('/api/v1/admin/views')];
    calls.push(apiRequest('/api/v1/admin/moderation/reports?status=open&page=1'));
    Promise.all(calls).then(([stats, views, moderation]) => { if (active) setData({ stats, views, moderation }); }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [apiRequest, user?.role]);
  if (error) return <div className="dash-state" role="alert">Không thể tải tổng quan: {error}<button onClick={() => window.location.reload()}>Thử lại</button></div>;
  if (!data) return <div className="dash-loading" aria-label="Đang tải tổng quan"><div /><div /><div /><div /><div /></div>;
  const { stats, views, moderation } = data;
  const cards = [
    { label: 'Người dùng', value: number(stats.totalUsers), hint: 'Tài khoản trên hệ thống', icon: '◎' },
    { label: 'Lượt xem', value: number(stats.totalViews), hint: 'Tổng lượt xem', icon: '▶' },
    { label: 'Bình luận', value: number(stats.totalComments), hint: 'Tương tác cộng đồng', icon: '◉' },
    { label: 'Đánh giá', value: number(stats.totalRatings), hint: `Trung bình ${stats.avgRating || 0}/5`, icon: '★' },
    ...(user?.role === 'admin' ? [{ label: 'Doanh thu', value: money(stats.totalRevenue), hint: 'Từ số liệu hệ thống', icon: '₫' }] : []),
    { label: 'Phim & tập', value: `${number(stats.totalProductions)} / ${number(stats.totalEpisodes)}`, hint: 'Nội dung đang quản lý', icon: '▣' },
  ];
  const daily = views.daily || [], max = Math.max(1, ...daily.map((item) => Number(item.total_views || 0)));
  return <div className="dash"><div className="dash-heading"><div><h2>Tổng quan hoạt động</h2><p>Số liệu hệ thống, cập nhật từ các API quản trị hiện có.</p></div><span>{new Date().toLocaleDateString('vi-VN')}</span></div>
    <div className="dash-kpis">{cards.map((card) => <article key={card.label}><div className="dash-card-icon">{card.icon}</div><small>{card.label}</small><strong>{card.value}</strong><span>{card.hint}</span></article>)}</div>
    <div className="dash-middle"><section className="dash-panel dash-chart"><div className="dash-panel-heading"><div><small>HOẠT ĐỘNG</small><h3>Lượt xem 30 ngày</h3></div><Link to="/admin/views">Xem chi tiết →</Link></div>{daily.length ? <><div className="dash-bars" aria-label="Biểu đồ lượt xem theo ngày">{daily.map((item) => <div key={item.stat_date} title={`${new Date(item.stat_date).toLocaleDateString('vi-VN')}: ${number(item.total_views)} lượt xem`}><span style={{ height: `${Math.max(3, Number(item.total_views || 0) / max * 100)}%` }} /></div>)}</div><div className="dash-chart-axis"><span>{new Date(daily[0].stat_date).toLocaleDateString('vi-VN')}</span><span>{new Date(daily[daily.length - 1].stat_date).toLocaleDateString('vi-VN')}</span></div></> : <p className="dash-empty">Chưa có số liệu lượt xem trong giai đoạn này.</p>}</section>
      <section className="dash-panel dash-alerts"><div className="dash-panel-heading"><div><small>ƯU TIÊN</small><h3>Cần chú ý</h3></div></div>{moderation ? <><Link to="/admin/community-hub/moderation"><b>{moderation.stats?.open || 0}</b><span>Báo cáo chờ xử lý</span><i>→</i></Link>{user?.role === 'admin' && <Link to="/admin/community-hub/moderation"><b>{moderation.stats?.flagsOpen || 0}</b><span>Cờ điểm cần kiểm tra</span><i>→</i></Link>}</> : <p className="dash-empty">Xem mục nội dung để theo dõi hoạt động cộng đồng.</p>}<Link to="/admin/community-hub/vip?view=payments"><b>VIP</b><span>Duyệt thanh toán</span><i>→</i></Link></section></div>
    {user?.role === 'admin' && <section className="dash-panel"><div className="dash-panel-heading"><div><small>GẦN ĐÂY</small><h3>Người dùng mới</h3></div><Link to="/admin/community-hub/users">Quản lý người dùng →</Link></div><div className="dash-recent">{stats.recentUsers?.length ? stats.recentUsers.map((entry) => <div key={entry.id}><span className="dash-avatar">{entry.username?.slice(0, 1).toUpperCase()}</span><div><strong>{entry.username}</strong><small>{entry.email}</small></div><span className={`dash-status ${entry.status === 'active' ? 'is-active' : ''}`}>{entry.status === 'active' ? 'Hoạt động' : 'Đã khóa'}</span><time>{new Date(entry.created_at).toLocaleDateString('vi-VN')}</time></div>) : <p className="dash-empty">Chưa có người dùng mới.</p>}</div></section>}
  </div>;
}
