import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.js';
import './moderation.css';

const labels = { post: 'Bài viết / review', comment: 'Bình luận', rating: 'Đánh giá phim', user: 'Tài khoản' };
const reasonLabels = { spam: 'Spam', harassment: 'Quấy rối', inappropriate: 'Ngôn từ không phù hợp', spoiler: 'Spoiler', fraud: 'Gian lận', other: 'Khác' };
const reportLink = (item) => item.review_source === 'rating' ? `/movies/${item.target_id}` : item.target_type === 'post' ? `/community/${String(item._id).startsWith('scene-question:') ? 'scene-questions' : 'posts'}/${item.target_id}` : item.target_type === 'user' ? `/community/users/${item.target_id}` : item.comment_source === 'movie' ? item.production_id ? `/movies/${item.production_id}?commentId=${item.target_id}` : null : item.post_id ? `/community/${item.comment_source === 'scene' ? 'scene-questions' : 'posts'}/${item.post_id}?commentId=${item.target_id}` : null;
export default function ModerationAdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], stats: {} });
  const [flags, setFlags] = useState([]);
  const [message, setMessage] = useState('');
  const load = useCallback(async (nextStatus = status, nextPage = page) => {
    const [reports, suspicious] = await Promise.all([
      apiRequest(`/api/v1/admin/moderation/reports?status=${nextStatus}&page=${nextPage}`),
      isAdmin ? apiRequest('/api/v1/admin/moderation/flags?status=open') : Promise.resolve({ items: [] }),
    ]);
    setData(reports); setFlags(suspicious.items || []);
  }, [status, page, isAdmin]);
  useEffect(() => {
    apiRequest(`/api/v1/admin/moderation/reports?status=${status}&page=${page}`).then(setData).catch((error) => setMessage(error.message));
    if (isAdmin) apiRequest('/api/v1/admin/moderation/flags?status=open').then((result) => setFlags(result.items || [])).catch((error) => setMessage(error.message));
  }, [status, page, isAdmin]);
  const resolve = async (id, body) => {
    try { await apiRequest(`/api/v1/admin/moderation/reports/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify(body) }); setMessage('Đã xử lý báo cáo.'); await load(); }
    catch (error) { setMessage(error.message); }
  };
  const reviewFlag = async (id, body) => {
    try { await apiRequest(`/api/v1/admin/moderation/flags/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify(body) }); setMessage('Đã ghi nhận kết quả kiểm tra.'); await load(); }
    catch (error) { setMessage(error.message); }
  };
  return <main className="mod-admin"><header><small>ZFLIX / TRUST & SAFETY</small><h1>Kiểm duyệt cộng đồng</h1><p>Xem báo cáo và ghi nhận quyết định có lý do.</p></header>
    {message && <p role="status" className="mod-message">{message}</p>}
    <div className="mod-stats"><div><strong>{data.stats?.open || 0}</strong><span>Chờ xử lý</span></div><div><strong>{data.stats?.resolved || 0}</strong><span>Đã xử lý</span></div><div><strong>{data.stats?.dismissed || 0}</strong><span>Đã từ chối</span></div>{isAdmin && <div><strong>{data.stats?.flagsOpen || 0}</strong><span>Cờ điểm cần xem</span></div>}</div>
    <section className="mod-panel"><div className="mod-panel-head"><h2>Báo cáo</h2><label>Trạng thái <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="open">Chờ xử lý</option><option value="resolved">Đã xử lý</option><option value="dismissed">Đã từ chối</option><option value="all">Tất cả</option></select></label></div>
      {data.items?.length ? data.items.map((item) => <ReportCard key={item._id} item={item} onResolve={(body) => resolve(item._id, body)} />) : <p className="mod-empty">Không có báo cáo trong mục này.</p>}
      <div className="mod-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</button><span>Trang {page} · {data.total || 0} báo cáo</span><button disabled={!data.hasMore} onClick={() => setPage(page + 1)}>Sau →</button></div>
    </section>
    {isAdmin && <section className="mod-panel"><div className="mod-panel-head"><h2>Hoạt động điểm bất thường</h2><span>Cờ chỉ gợi ý kiểm tra, không tự kết luận gian lận</span></div>{flags.length ? flags.map((flag) => <FlagCard key={flag._id} flag={flag} onReview={(body) => reviewFlag(flag._id, body)} />) : <p className="mod-empty">Không có cờ đang mở.</p>}</section>}
  </main>;
}

function ReportCard({ item, onResolve }) {
  const [action, setAction] = useState(item.target_type === 'user' ? 'warn' : 'hide');
  const [reason, setReason] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const url = reportLink(item);
  const submit = async () => { setBusy(true); try { await onResolve({ action, reason, ...(action === 'lock' && { durationHours }) }); } finally { setBusy(false); } };
  return <article className="mod-report"><div className="mod-report-top"><span>{item.review_source === 'rating' ? 'Đánh giá phim' : labels[item.target_type] || item.target_type}</span><time>{new Date(item.created_at).toLocaleString('vi-VN')}</time></div><h3>{reasonLabels[item.reason] || item.reason} · #{item.target_id}</h3>{item.target_type === 'comment' && <div className="mod-report-excerpt"><small>Bình luận bị báo cáo</small><p>{item.target_excerpt || 'Không còn nội dung bình luận để hiển thị.'}</p></div>}<p>{item.description || 'Không có mô tả bổ sung.'}</p><small>Người báo #{item.reporter_id} · {item.status}{item.action ? ` · ${item.action}` : ''}</small>{url && <Link to={url}>{item.target_type === 'comment' ? 'Đi tới bình luận' : 'Xem nội dung'} →</Link>}
    {item.status === 'open' && <div className="mod-actions"><label>Hành động<select value={action} onChange={(event) => setAction(event.target.value)}><option value="dismiss">Từ chối báo cáo</option>{item.target_type !== 'user' && <><option value="hide">Ẩn nội dung</option><option value="delete">Xóa nội dung</option></>}<option value="warn">Cảnh cáo{item.target_type !== 'user' ? ' và ẩn' : ''}</option><option value="lock">Khóa tài khoản{item.target_type !== 'user' ? ' và ẩn' : ''}</option></select></label>{action === 'lock' && <label>Thời gian (giờ)<input type="number" min="1" max="720" value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} /></label>}<label className="mod-reason">Lý do quyết định<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ít nhất 10 ký tự" /></label><button disabled={busy || reason.trim().length < 10} onClick={submit}>Xác nhận</button></div>}
  </article>;
}
function FlagCard({ flag, onReview }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (decision) => { setBusy(true); try { await onReview({ decision, reason }); } finally { setBusy(false); } };
  return <article className="mod-report"><div className="mod-report-top"><span>UPVOTE / POINTS</span><time>{new Date(flag.createdAt).toLocaleString('vi-VN')}</time></div><h3>{flag.reason}</h3><p>Tài khoản #{flag.userId}{flag.actorId ? ` · Người tương tác #${flag.actorId}` : ''} · {flag.day}</p><Link to={`/community/users/${flag.userId}`}>Xem hồ sơ →</Link><div className="mod-actions"><label className="mod-reason">Lý do kiểm tra<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ít nhất 10 ký tự" /></label><button disabled={busy || reason.trim().length < 10} onClick={() => submit('clear')}>Bỏ cờ</button><button className="danger" disabled={busy || reason.trim().length < 10} onClick={() => submit('confirm')}>Xác nhận gian lận</button></div></article>;
}
