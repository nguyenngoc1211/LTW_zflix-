import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import './quests.css';

const formatEnd = (value) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export default function QuestsPage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => apiRequest('/api/v1/quests/me').then(setData).catch((error) => setMessage(error.message)), []);
  useEffect(() => { load(); }, [load]);
  const claim = async (id) => {
    setBusy(id); setMessage('');
    try { const reward = await apiRequest(`/api/v1/quests/${id}/claim`, { method: 'POST' }); setMessage(`Đã nhận ${reward.points} điểm nhiệm vụ.`); await load(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  };
  const groups = [{ key: 'daily', title: 'Mỗi ngày', end: data?.dailyEndsAt }, { key: 'weekly', title: 'Mỗi tuần', end: data?.weeklyEndsAt }];
  return <main className="quests-page"><div className="quests-wrap">
    <header className="quests-hero"><Link to="/community">← Cộng đồng</Link><span>ZFLIX / NHIỆM VỤ</span><h1>Đóng góp. Tích điểm.<br /><em>Ghi dấu ấn.</em></h1><p>Hoàn thành hoạt động hợp lệ trong cộng đồng để nhận điểm và mở khóa huy hiệu.</p><div><Link to="/leaderboard">Bảng xếp hạng →</Link></div></header>
    {message && <p className="quests-message" role="status">{message}</p>}
    {!data && !message && <p className="quests-message">Đang tải nhiệm vụ...</p>}
    {data && groups.map((group) => <section className="quests-section" key={group.key}><div className="quests-section-head"><div><small>{group.key === 'daily' ? '01 / DAILY' : '02 / WEEKLY'}</small><h2>{group.title}</h2></div><span>Đặt lại {formatEnd(group.end)}</span></div><div className="quests-grid">{data.quests.filter((quest) => quest.cadence === group.key).map((quest) => <article className={`quest-card ${quest.claimed ? 'quest-card-done' : ''}`} key={quest.id}><div className="quest-card-top"><span>{quest.action.toUpperCase()}</span><strong>+{quest.points} ĐIỂM</strong></div><h3>{quest.title}</h3><p>{quest.progress}/{quest.target} hoạt động hợp lệ</p><div className="quest-track" role="progressbar" aria-valuenow={quest.progress} aria-valuemin="0" aria-valuemax={quest.target} aria-label={quest.title}><i style={{ width: `${Math.min(100, quest.progress / quest.target * 100)}%` }} /></div><button type="button" disabled={!quest.completed || quest.claimed || quest.revoked || busy === quest.id} onClick={() => claim(quest.id)}>{quest.claimed ? 'Đã nhận thưởng' : quest.revoked ? 'Đã thu hồi' : quest.completed ? 'Nhận điểm' : 'Đang thực hiện'}</button></article>)}</div></section>)}
    {data && <section className="quests-section"><div className="quests-section-head"><div><small>03 / ACHIEVEMENTS</small><h2>Huy hiệu</h2></div><span>{data.achievements.filter((item) => item.earned).length}/{data.achievements.length} đã đạt</span></div><div className="quests-badges">{data.achievements.map((item) => <article className={item.earned ? 'earned' : ''} key={item.id}><div className="quests-badge-icon">{item.icon}</div><h3>{item.title}</h3><p>{item.description}</p><small>{item.progress}/{item.target} {item.earned ? '· Đã đạt' : ''}</small></article>)}</div></section>}
    {data?.history?.length > 0 && <section className="quests-section"><div className="quests-section-head"><div><small>04 / HISTORY</small><h2>Đã hoàn thành</h2></div></div><div className="quests-history">{data.history.map((item) => <p key={`${item.questId}:${item.period}`}><strong>{item.questId}</strong><span>{item.period} · {item.status === 'claimed' ? `+${item.points} điểm` : 'Đã thu hồi'}</span></p>)}</div></section>}
  </div></main>;
}
