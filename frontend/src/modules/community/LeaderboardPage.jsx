import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.js';
import './leaderboard.css';

const medals = ['🥇', '🥈', '🥉'];
export default function LeaderboardPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState('');
  const [board, setBoard] = useState(null);
  const [months, setMonths] = useState([]);
  const [mine, setMine] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  useEffect(() => { const tick = () => setNow(Date.now()); const initial = setTimeout(tick, 0); const timer = setInterval(tick, 60000); return () => { clearTimeout(initial); clearInterval(timer); }; }, []);
  useEffect(() => { apiRequest('/api/v1/points/months').then((result) => setMonths(result.months || [])).catch(() => {}); }, []);
  useEffect(() => { let active = true; apiRequest(`/api/v1/points/leaderboard${month ? `?month=${month}` : ''}`).then((result) => { if (active) { setBoard(result); setError(''); } }).catch((cause) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [month]);
  useEffect(() => { if (!user) return; Promise.all([apiRequest('/api/v1/points/me'), apiRequest('/api/v1/points/me/history?limit=20')]).then(([points, transactions]) => { setMine(points); setHistory(transactions.items || []); }).catch(() => {}); }, [user]);
  const top = board?.top || [];
  const remainingMinutes = now && board ? Math.max(0, Math.ceil((new Date(board.closesAt).getTime() - now) / 60000)) : 0;
  return <main className="points-page">
    <div className="points-heading"><div><Link to="/community">← Cộng đồng</Link><p>ZFLIX POINTS</p><h1>Bảng xếp hạng tháng</h1><span>Đóng góp cho cộng đồng phim, tích điểm và nhận VIP.</span></div><label>Tháng <select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Tháng hiện tại</option>{months.map((item) => <option key={item.month} value={item.month}>{item.month}</option>)}</select></label></div>
    {error && <p role="alert">{error}</p>}
    {board && <><div className="points-rewards"><strong>Phần thưởng</strong>{board.rewards?.map((reward) => <span key={reward.rank}>Top {reward.rank} · VIP {reward.days} ngày từ {reward.min} điểm</span>)}<span>Top 4–10 · Huy hiệu tháng</span><small>{board.closed ? 'Tháng đã chốt' : `Còn ${Math.floor(remainingMinutes / 1440)} ngày ${Math.floor(remainingMinutes % 1440 / 60)} giờ ${remainingMinutes % 60} phút · ${new Date(board.closesAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`}</small></div>
      <div className="points-podium">{top.slice(0, 3).map((row, index) => <div key={row.userId} className={`points-medal points-medal-${index + 1}`}><b>{medals[index]}</b><Link to={`/community/users/${row.userId}`}>{row.username}</Link><strong>{row.points} điểm</strong><small>Hạng {row.rank}</small></div>)}</div>
      {board.me && <div className="points-own">Hạng của bạn: <strong>#{board.me.rank}</strong> · {board.me.points} điểm</div>}
      <section className="points-list"><h2>Top 100</h2>{top.length ? <ol>{top.map((row) => <li key={row.userId}><span>#{row.rank}</span><Link to={`/community/users/${row.userId}`}>{row.username}</Link><strong>{row.points} điểm</strong></li>)}</ol> : <p>Chưa có điểm trong tháng này.</p>}</section></>}
    {user && <section className="points-personal"><h2>Điểm của tôi</h2><div><strong>{mine?.totalPoints ?? 0}</strong><span>Tổng tích lũy</span><strong>{mine?.monthlyPoints ?? 0}</strong><span>Điểm tháng này</span><strong>{mine?.rank ? `#${mine.rank}` : '—'}</strong><span>Hạng hiện tại</span></div><h3>Huy hiệu & phần thưởng</h3><p>{mine?.badges?.length ? mine.badges.map((badge) => `${badge.month} · Top ${badge.rank} · ${badge.kind === 'vip' ? `VIP ${badge.days} ngày` : 'Huy hiệu'}`).join(' | ') : 'Chưa có phần thưởng.'}</p><h3>Lịch sử điểm</h3><ul>{history.map((item, index) => <li key={`${item.createdAt}:${index}`}><span>{item.type}</span><time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time><strong>{item.points > 0 ? '+' : ''}{item.points}</strong></li>)}</ul></section>}
  </main>;
}
