import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { API_URL } from '../../services/api.js';
import AdminCommentThread from './AdminCommentThread.jsx';
import AdminModal from '../ui/AdminModal.jsx';
import AdminLockAccountDialog from './AdminLockAccountDialog.jsx';

const mediaUrl = (url) => url?.startsWith('/') ? `${API_URL}${url}` : url;
export default function AdminPostDetail({ postId, onBack, onDeleted }) {
  const { apiRequest, user: currentUser } = useAuth();
  const [post, setPost] = useState(null);
  const [base, setBase] = useState('/api/v1/community/posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState(null);
  const [lockedUsers, setLockedUsers] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        let endpoint = '/api/v1/community/posts';
        let result;
        try { result = await apiRequest(`${endpoint}/${postId}`); }
        catch (cause) { if (cause.status !== 404) throw cause; endpoint = '/api/v1/scene-questions'; result = await apiRequest(`${endpoint}/${postId}`); }
        if (active) { setPost(result); setBase(endpoint); setError(''); }
      } catch (cause) { if (active) setError(cause.message); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [apiRequest, postId]);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try { await apiRequest(`${base}/${postId}`, { method: 'DELETE' }); onDeleted(); }
    catch (cause) { setError(cause.message); setConfirm(false); }
    finally { setBusy(false); }
  };
  return <div className="admin-post-detail"><div className="admin-content-detailbar"><button className="admin-content-back" onClick={onBack}>← Danh sách bài viết</button><span>Bài viết #{postId}</span></div>{loading && <div className="admin-content-panel admin-detail-loading">Đang tải bài viết...</div>}{error && <p role="alert" className="admin-content-error">{error}</p>}{post && <><article className="admin-post-article"><div className="admin-post-topline"><span className="admin-content-badge">{post.category || post.content_type || 'Bài viết'}</span><span>{new Date(post.created_at).toLocaleString('vi-VN')}</span><div className="admin-thread-menu"><button aria-label="Thao tác bài viết" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>···</button>{menuOpen && <div role="menu">{currentUser?.role === 'admin' && (post.author?.id || post.author_id) && Number(post.author?.id || post.author_id) !== Number(currentUser.id) && !lockedUsers.includes(Number(post.author?.id || post.author_id)) && <button role="menuitem" onClick={() => { setMenuOpen(false); setLockTarget({ id: Number(post.author?.id || post.author_id), username: post.author?.username }); }}>Khóa tài khoản tác giả</button>}<button role="menuitem" onClick={() => { setMenuOpen(false); setConfirm(true); }}>Xóa bài viết</button></div>}</div></div><h2>{post.title}</h2><div className="admin-post-author"><span className="admin-thread-avatar">{post.author?.avatar_url ? <img src={mediaUrl(post.author.avatar_url)} alt="" /> : (post.author?.username || '?').slice(0, 1).toUpperCase()}</span><strong>{post.author?.username || `Tác giả #${post.author_id}`}</strong><span>·</span><span>{post.visibility === 'members' ? 'Chỉ thành viên' : 'Công khai'}</span></div>{post.production && <div className="admin-post-related">Phim liên quan <strong>{post.production.title}</strong></div>}<div className="admin-post-body">{post.content || 'Không có nội dung văn bản.'}</div>{post.image_urls?.length > 0 && <div className="admin-post-images">{post.image_urls.map((url, index) => <img key={url} src={mediaUrl(url)} alt={`Ảnh bài viết ${index + 1}`} loading="lazy" />)}</div>}<div className="admin-post-metrics"><span>↑ {post.upvotes || 0}</span><span>↓ {post.downvotes || 0}</span><span>◌ {post.comment_count || 0} bình luận</span>{post.rating && <span>★ {post.rating}/5</span>}</div></article><AdminCommentThread source="post" sourceId={postId} base={base} onChanged={() => setPost((current) => current && ({ ...current, comment_count: Math.max(0, (current.comment_count || 0) - 1) }))} /></>}{lockedUsers.includes(Number(post?.author?.id || post?.author_id)) && <p className="admin-content-success">Tài khoản tác giả đã bị khóa.</p>}{lockTarget && <AdminLockAccountDialog target={lockTarget} onClose={() => setLockTarget(null)} onLocked={({ id }) => setLockedUsers((value) => [...value, Number(id)])} />}{confirm && <AdminModal title="Xóa bài viết" onClose={() => setConfirm(false)}><p>Xóa bài “{post?.title}”? Điểm và tiến độ liên quan sẽ được hệ thống thu hồi.</p><div className="admin-content-actions"><button onClick={() => setConfirm(false)}>Hủy</button><button disabled={busy} className="admin-content-primary" onClick={remove}>{busy ? 'Đang xử lý...' : 'Xác nhận xóa'}</button></div></AdminModal>}</div>;
}
