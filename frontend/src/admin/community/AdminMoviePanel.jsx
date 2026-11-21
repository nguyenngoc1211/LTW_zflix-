import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { API_URL } from '../../services/api.js';
import AdminCommentThread from './AdminCommentThread.jsx';
import AdminModal from '../ui/AdminModal.jsx';
import AdminLockAccountDialog from './AdminLockAccountDialog.jsx';

const imageUrl = (value) => value?.startsWith('/') ? `${API_URL}${value}` : value;
const validId = (raw) => { const value = Number(raw); return Number.isSafeInteger(value) && value > 0 ? value : null; };
export default function AdminMoviePanel() {
  const { apiRequest } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.min(validId(params.get('moviePage')) || 1, 1000);
  const search = params.get('movieSearch') || '';
  const movieId = validId(params.get('movieId'));
  const [draft, setDraft] = useState(search);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const update = (values) => setParams((previous) => { const next = new URLSearchParams(previous); next.set('view', 'movies'); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, String(value)); else next.delete(key); } return next; });
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) query.set('search', search);
    apiRequest(`/api/v1/admin/productions?${query}`).then((result) => { if (active) { setData(result); setError(''); } }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiRequest, page, search]);
  if (movieId) return <MovieDetail movieId={movieId} onBack={() => update({ movieId: null })} />;
  return <section className="admin-content-panel"><div className="admin-content-header"><div><h3>Phim trên ZFLIX</h3><p>Chọn phim để xem và xử lý bình luận, reply và review.</p></div><span className="admin-content-count">{data?.total ?? '—'} phim</span></div><form className="admin-content-filters" onSubmit={(event) => { event.preventDefault(); update({ movieSearch: draft.trim(), moviePage: null }); }}><input aria-label="Tìm phim" placeholder="Tìm tên phim..." value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="admin-content-primary">Tìm phim</button></form>{error && <p role="alert" className="admin-content-error">{error}</p>}<div className="admin-content-table-wrap"><table className="admin-content-table"><thead><tr><th>Phim</th><th>Loại</th><th>Năm</th><th>Đánh giá</th><th></th></tr></thead><tbody>{loading && !data ? <tr><td colSpan="5">Đang tải danh sách phim...</td></tr> : data?.items.length ? data.items.map((movie) => <tr key={movie.id}><td><div className="admin-movie-cell">{movie.poster_url ? <img src={imageUrl(movie.poster_url)} alt="" loading="lazy" /> : <span className="admin-movie-placeholder">▶</span>}<div><button className="admin-content-title" onClick={() => update({ movieId: movie.id })}>{movie.title}</button><small>#{movie.id} · {movie.status || 'Đang phát hành'}</small></div></div></td><td>{movie.type || '—'}</td><td>{movie.release_year || '—'}</td><td>★ {movie.rating_avg || 0} · {movie.rating_count || 0} review</td><td><button className="admin-content-open" onClick={() => update({ movieId: movie.id })}>Quản lý →</button></td></tr>) : <tr><td colSpan="5">Không tìm thấy phim phù hợp.</td></tr>}</tbody></table></div><div className="admin-content-pages"><button disabled={page <= 1} onClick={() => update({ moviePage: page - 1 })}>← Trước</button><span>Trang {page} / {data?.pages || 1}</span><button disabled={page >= (data?.pages || 1)} onClick={() => update({ moviePage: page + 1 })}>Sau →</button></div></section>;
}
function MovieDetail({ movieId, onBack }) {
  const { apiRequest } = useAuth();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('comments');
  useEffect(() => { let active = true; apiRequest(`/api/v1/productions/${movieId}`).then((result) => { if (active) setMovie(result); }).catch((cause) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [apiRequest, movieId]);
  return <div className="admin-post-detail"><div className="admin-content-detailbar"><button className="admin-content-back" onClick={onBack}>← Danh sách phim</button><span>Phim #{movieId}</span></div>{error && <p role="alert" className="admin-content-error">{error}</p>}{!movie && !error && <div className="admin-content-panel">Đang tải thông tin phim...</div>}{movie && <><header className="admin-movie-hero">{movie.poster_url ? <img src={imageUrl(movie.poster_url)} alt="" /> : <span className="admin-movie-placeholder">▶</span>}<div><span className="admin-content-eyebrow">MOVIE DISCUSSION</span><h2>{movie.title}</h2><p>{movie.release_year || '—'} · {movie.type || 'Phim'} · ★ {movie.rating_avg || 0} / 5</p></div></header><nav className="admin-movie-subtabs" aria-label="Nội dung phim"><button className={view === 'comments' ? 'is-active' : ''} onClick={() => setView('comments')}>Bình luận & reply</button><button className={view === 'reviews' ? 'is-active' : ''} onClick={() => setView('reviews')}>Review phim</button></nav>{view === 'comments' ? <AdminCommentThread source="movie" sourceId={movieId} base="/api/v1/productions" /> : <MovieReviews movieId={movieId} />}</>}</div>;
}
function MovieReviews({ movieId }) {
  const { apiRequest, user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lockTarget, setLockTarget] = useState(null);
  const [lockedUsers, setLockedUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { let active = true; apiRequest(`/api/v1/admin/ratings?productionId=${movieId}&page=${page}&limit=20`).then((result) => { if (active) { setData(result); setError(''); } }).catch((cause) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [apiRequest, movieId, page, refresh]);
  const remove = async () => { if (!selected || busy) return; setBusy(true); try { await apiRequest(`/api/v1/admin/ratings/${selected.user_id}/${movieId}`, { method: 'DELETE' }); setData((current) => current && ({ ...current, items: current.items.filter((item) => item.user_id !== selected.user_id), total: Math.max(0, current.total - 1) })); setSelected(null); setConfirm(false); setRefresh((value) => value + 1); } catch (cause) { setError(cause.message); setConfirm(false); } finally { setBusy(false); } };
  return <section className="admin-content-panel"><div className="admin-content-header"><div><span className="admin-content-eyebrow">REVIEWS</span><h3>Đánh giá phim</h3><p>{data?.total ?? '—'} review thuộc phim này</p></div></div>{error && <p role="alert" className="admin-content-error">{error}</p>}{!data && !error && <p className="admin-content-muted">Đang tải review...</p>}<div className="admin-content-table-wrap"><table className="admin-content-table"><thead><tr><th>Người viết</th><th>Điểm</th><th>Nội dung</th><th>Thời gian</th><th></th></tr></thead><tbody>{data?.items.length ? data.items.map((item) => <tr key={`${item.user_id}:${item.production_id}`}><td>{item.username}</td><td>★ {item.rating}/5</td><td><strong>{item.review_title || 'Review phim'}</strong><small className="admin-review-excerpt">{item.review_content || 'Không có nhận xét.'}</small></td><td>{new Date(item.created_at).toLocaleDateString('vi-VN')}</td><td><button className="admin-content-open" onClick={() => setSelected(item)}>Xem →</button></td></tr>) : data && <tr><td colSpan="5">Chưa có review cho phim này.</td></tr>}</tbody></table></div>{data && (page > 1 || page < data.pages) && <div className="admin-content-pages"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Trước</button><span>Trang {page} / {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)}>Sau →</button></div>}{selected && <AdminModal title="Chi tiết review" onClose={() => { setSelected(null); setConfirm(false); }}><div className="admin-review-detail"><span className="admin-content-badge">★ {selected.rating}/5</span><h3>{selected.review_title || 'Review phim'}</h3><p>{selected.username} · {new Date(selected.created_at).toLocaleString('vi-VN')}</p><div>{selected.review_content || 'Không có nội dung nhận xét.'}</div></div>{error && <p role="alert" className="admin-content-error">{error}</p>}<div className="admin-content-actions"><button onClick={() => setSelected(null)}>Đóng</button>{currentUser?.role === 'admin' && selected.user_id && Number(selected.user_id) !== Number(currentUser.id) && !lockedUsers.includes(Number(selected.user_id)) && <button className="admin-content-secondary" onClick={() => setLockTarget({ id: Number(selected.user_id), username: selected.username })}>Khóa tài khoản</button>}<button className="admin-content-secondary" onClick={() => setConfirm(true)}>··· Thao tác</button></div></AdminModal>}{lockTarget && <AdminLockAccountDialog target={lockTarget} onClose={() => setLockTarget(null)} onLocked={({ id }) => setLockedUsers((value) => [...value, Number(id)])} />}{confirm && selected && <AdminModal title="Xóa review" onClose={() => setConfirm(false)}><p>Xóa review của {selected.username}? Dữ liệu đánh giá của phim sẽ được hệ thống cập nhật.</p><div className="admin-content-actions"><button onClick={() => setConfirm(false)}>Hủy</button><button disabled={busy} className="admin-content-primary" onClick={remove}>{busy ? 'Đang xử lý...' : 'Xác nhận xóa'}</button></div></AdminModal>}</section>;
}
