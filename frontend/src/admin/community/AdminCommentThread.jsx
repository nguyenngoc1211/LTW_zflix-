import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { API_URL } from '../../services/api.js';
import AdminModal from '../ui/AdminModal.jsx';
import AdminLockAccountDialog from './AdminLockAccountDialog.jsx';

const avatarUrl = (value) => value?.startsWith('/') ? `${API_URL}${value}` : value;
const identity = (item) => item.author || { id: item.user_id, username: item.username, avatar_url: item.avatar_url };
export default function AdminCommentThread({ source, sourceId, base, onChanged }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const changed = () => { setRefresh((value) => value + 1); onChanged?.(); };
  return <section className="admin-thread"><div className="admin-thread-heading"><div><span className="admin-content-eyebrow">DISCUSSION</span><h3>Bình luận & trả lời</h3></div><form onSubmit={(event) => { event.preventDefault(); setSearch(draft.trim()); }}><input aria-label="Tìm bình luận" placeholder="Tìm trong bình luận..." value={draft} onChange={(event) => setDraft(event.target.value)} /><button>Tìm</button></form></div>{search && <div className="admin-thread-search-note">Kết quả chứa “{search}” <button onClick={() => { setSearch(''); setDraft(''); }}>Xóa tìm kiếm</button></div>}{search ? <CommentSearch key={`${sourceId}:${search}`} source={source} sourceId={sourceId} search={search} base={base} refresh={refresh} onChanged={changed} /> : <CommentBranch key={`${source}:${sourceId}`} source={source} sourceId={sourceId} base={base} parentId={null} depth={0} refresh={refresh} onChanged={changed} />}</section>;
}
function CommentBranch({ source, sourceId, base, parentId, depth, refresh, onChanged }) {
  const { apiRequest } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (source === 'movie') { query.set('limit', '20'); query.set('parentId', parentId ?? 'root'); }
    else if (parentId) query.set('parentId', String(parentId));
    apiRequest(`${base}/${sourceId}/comments?${query}`).then((result) => { if (active) { setData(result); setError(''); } }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiRequest, source, sourceId, base, parentId, page, refresh]);
  return <div className={depth ? 'admin-thread-branch' : 'admin-thread-root'}>{loading && !data && <p className="admin-content-muted">Đang tải bình luận...</p>}{error && <p role="alert" className="admin-content-error">{error}</p>}{!loading && data?.items.length === 0 && <p className="admin-content-muted">Chưa có bình luận ở trang này.</p>}{data?.items.map((item) => <CommentNode key={item.id} item={item} source={source} sourceId={sourceId} base={base} depth={depth} refresh={refresh} onChanged={onChanged} />)}{data && (page > 1 || data.hasMore) && <div className="admin-content-pages"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Trước</button><span>Trang {page}</span><button disabled={!data.hasMore} onClick={() => setPage((value) => value + 1)}>Sau →</button></div>}</div>;
}
function CommentSearch({ source, sourceId, search, base, refresh, onChanged }) {
  const { apiRequest } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ source, sourceId: String(sourceId), search, page: String(page) });
    apiRequest(`/api/v1/admin/content/comments?${query}`).then((result) => { if (active) { setData(result); setError(''); } }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [apiRequest, source, sourceId, search, page, refresh]);
  return <div>{!data && !error && <p className="admin-content-muted">Đang tìm bình luận...</p>}{error && <p role="alert" className="admin-content-error">{error}</p>}{data?.items.length === 0 && <p className="admin-content-muted">Không có bình luận phù hợp.</p>}{data?.items.map((item) => <CommentNode key={item.id} item={item} source={source} sourceId={sourceId} base={base} depth={0} refresh={refresh} onChanged={onChanged} searchResult />)}{data && (page > 1 || data.hasMore) && <div className="admin-content-pages"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Trước</button><span>{data.total} kết quả · Trang {page}</span><button disabled={!data.hasMore} onClick={() => setPage((value) => value + 1)}>Sau →</button></div>}</div>;
}
function CommentNode({ item, source, sourceId, base, depth, refresh, onChanged, searchResult = false }) {
  const { apiRequest, user: currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState(null);
  const [locked, setLocked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const author = identity(item);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try { await apiRequest(source === 'movie' ? `/api/v1/admin/comments/${item.id}` : `${base}/${sourceId}/comments/${item.id}`, { method: 'DELETE' }); setConfirm(false); onChanged(); }
    catch (cause) { setError(cause.message); setConfirm(false); }
    finally { setBusy(false); }
  };
  return <article className={`admin-thread-comment ${depth ? 'is-reply' : ''}`}><div className="admin-thread-avatar">{author.avatar_url ? <img src={avatarUrl(author.avatar_url)} alt="" /> : (author.username || '?').slice(0, 1).toUpperCase()}</div><div className="admin-thread-main"><div className="admin-thread-meta"><strong>{author.username || `#${author.id || item.author_id}`}</strong><span>·</span><time>{new Date(item.created_at).toLocaleString('vi-VN')}</time>{item.is_toxic ? <span className="admin-thread-flag">Cần xem xét</span> : null}<div className="admin-thread-menu"><button aria-label={`Thao tác bình luận ${item.id}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>···</button>{menuOpen && <div role="menu">{author.id && <Link to={`/community/users/${author.id}`} target="_blank" rel="noopener noreferrer" role="menuitem">Xem hồ sơ</Link>}{currentUser?.role === 'admin' && author.id && Number(author.id) !== Number(currentUser.id) && !locked && <button role="menuitem" onClick={() => { setMenuOpen(false); setLockTarget({ id: Number(author.id), username: author.username }); }}>Khóa tài khoản</button>}<button role="menuitem" disabled={item.status !== 'active' || (source === 'movie' && item.reply_count > 0)} onClick={() => { setMenuOpen(false); setConfirm(true); }}>Xóa nội dung</button>{source === 'movie' && item.reply_count > 0 && <small>Xóa reply trước khi xóa bình luận gốc.</small>}</div>}</div></div>{locked && <span className="admin-thread-flag">Tài khoản đã khóa</span>}<p className="admin-thread-body">{item.content}</p><div className="admin-thread-tools"><span className="admin-thread-votes">↑ {item.upvotes || 0} <i /> ↓ {item.downvotes || 0}</span>{searchResult && item.parent_id && <span>Trả lời bình luận #{item.parent_id}</span>}{item.reply_count > 0 && <button onClick={() => setExpanded((value) => !value)}>{expanded ? 'Thu gọn trả lời' : `Xem ${item.reply_count} trả lời`}</button>}</div>{error && <p role="alert" className="admin-content-error">{error}</p>}{expanded && <CommentBranch source={source} sourceId={sourceId} base={base} parentId={item.id} depth={depth + 1} refresh={refresh} onChanged={onChanged} />}</div>{lockTarget && <AdminLockAccountDialog target={lockTarget} onClose={() => setLockTarget(null)} onLocked={() => setLocked(true)} />}{confirm && <AdminModal title="Xóa bình luận" onClose={() => setConfirm(false)}><p>Xóa nội dung của {author.username || `#${author.id}`}? Điểm liên quan được hệ thống xử lý theo cơ chế hiện có.</p><div className="admin-content-actions"><button onClick={() => setConfirm(false)}>Hủy</button><button disabled={busy} className="admin-content-primary" onClick={remove}>{busy ? 'Đang xử lý...' : 'Xác nhận xóa'}</button></div></AdminModal>}</article>;
}
