import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import AdminPostDetail from './AdminPostDetail.jsx';

const categories = [['', 'Tất cả loại'], ['review', 'Review'], ['discussion', 'Thảo luận'], ['question', 'Hỏi đáp'], ['news', 'Tin tức'], ['meme', 'Meme'], ['poll', 'Bình chọn'], ['scene_question', 'Khoảnh khắc']];
const sorts = [['newest', 'Mới nhất'], ['oldest', 'Cũ nhất'], ['most_comments', 'Nhiều bình luận'], ['most_votes', 'Nhiều vote']];
const validPage = (raw) => { const n = Number(raw); return Number.isInteger(n) && n > 0 && n <= 1000 ? n : 1; };
const input = 'rounded-lg border border-slate-700 px-3 py-2 text-sm';
export default function AdminPostsPanel() {
  const { apiRequest } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = validPage(params.get('page'));
  const category = categories.some(([value]) => value === params.get('category')) ? params.get('category') || '' : '';
  const sort = sorts.some(([value]) => value === params.get('sort')) ? params.get('sort') : 'newest';
  const search = params.get('search') || '';
  const selectedId = params.get('postId') && Number.isSafeInteger(Number(params.get('postId'))) && Number(params.get('postId')) > 0 ? Number(params.get('postId')) : null;
  const [draft, setDraft] = useState(search);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const update = (values) => setParams((previous) => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, String(value)); else next.delete(key); } return next; });
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page), sort });
    if (search) query.set('search', search);
    if (category) query.set('category', category);
    apiRequest(`/api/v1/admin/quests/community-posts?${query}`).then((result) => { if (active) { setData(result); setError(''); } }).catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiRequest, page, search, category, sort, message]);
  if (selectedId) return <AdminPostDetail postId={selectedId} onBack={() => update({ postId: null })} onDeleted={() => { update({ postId: null }); setMessage('Đã xóa bài viết.'); }} />;
  return <section className="admin-content-panel"><div className="admin-content-header"><div><h3>Bài viết đang hoạt động</h3><p>{data?.total ?? '—'} bài · tìm kiếm trên toàn bộ nội dung</p></div></div>
    <form className="admin-content-filters" onSubmit={(event) => { event.preventDefault(); update({ search: draft.trim(), page: null }); }}><input className={input} aria-label="Tìm bài viết" placeholder="Tìm tiêu đề hoặc nội dung..." value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="admin-content-primary">Tìm</button><select aria-label="Lọc loại bài" className={input} value={category} onChange={(event) => update({ category: event.target.value, page: null })}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Sắp xếp bài viết" className={input} value={sort} onChange={(event) => update({ sort: event.target.value, page: null })}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></form>
    {message && <p role="status" className="admin-content-success">{message}</p>}{error && <p role="alert" className="admin-content-error">{error}</p>}
    <div className="admin-content-table-wrap"><table className="admin-content-table"><thead><tr><th>Bài viết</th><th>Tác giả</th><th>Tương tác</th><th>Thời gian</th><th></th></tr></thead><tbody>{loading && !data ? <tr><td colSpan="5">Đang tải bài viết...</td></tr> : data?.items.length ? data.items.map((post) => <tr key={post.id}><td><button className="admin-content-title" onClick={() => update({ postId: post.id })}>{post.title || `Bài #${post.id}`}</button><small>{post.category || post.content_type || 'Bài viết'} · {post.visibility === 'members' ? 'Thành viên' : 'Công khai'}</small></td><td>{post.author_name || `#${post.author_id}`}</td><td>{post.upvotes || 0} ↑ · {post.downvotes || 0} ↓ · {post.comment_count || 0} bình luận</td><td>{new Date(post.created_at).toLocaleString('vi-VN')}</td><td><button className="admin-content-open" onClick={() => update({ postId: post.id })}>Xem chi tiết →</button></td></tr>) : <tr><td colSpan="5">Không có bài viết phù hợp.</td></tr>}</tbody></table></div>
    <div className="admin-content-pages"><button disabled={page <= 1} onClick={() => update({ page: page - 1 })}>← Trước</button><span>Trang {page} / {Math.max(1, Math.ceil((data?.total || 0) / 20))}</span><button disabled={!data?.hasMore} onClick={() => update({ page: page + 1 })}>Sau →</button></div>
  </section>;
}
