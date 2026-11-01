import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { apiRequest, API_URL } from '../../services/api.js';
import PostComments from './PostComments.jsx';
import UserAvatar from '../../components/UserAvatar.jsx';

const endpoint = '/api/v1/community/posts';

function PostMetadata({ productionId, setProductionId, episodeId, setEpisodeId, communityId, setCommunityId, tags, setTags }) {
  return <fieldset className="space-y-3 rounded border border-zinc-700 p-3">
    <legend className="px-1">Thông tin liên quan không bắt buộc</legend>
    <label className="block">Mã phim<input type="number" min="1" step="1" value={productionId} onChange={(event) => { setProductionId(event.target.value); setEpisodeId(''); }} className="mt-1 w-full rounded bg-zinc-950 p-2" /></label>
    <label className="block">Mã tập<input type="number" min="1" step="1" disabled={!productionId} value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} className="mt-1 w-full rounded bg-zinc-950 p-2 disabled:opacity-50" /></label>
    <label className="block">Mã cộng đồng<input type="number" min="1" step="1" value={communityId} onChange={(event) => setCommunityId(event.target.value)} className="mt-1 w-full rounded bg-zinc-950 p-2" /></label>
    <label className="block">Thẻ chủ đề<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Ngăn cách bằng dấu phẩy" className="mt-1 w-full rounded bg-zinc-950 p-2" /></label>
    <p className="text-xs text-zinc-400">Mã tập là định danh tập, không phải số thứ tự tập. Đăng vào cộng đồng yêu cầu là thành viên.</p>
  </fieldset>;
}

export function PostCard({ post, user, onDelete, onUpdated, onUnsave }) {
  const [revealed, setRevealed] = useState(!post.is_spoiler);
  const [message, setMessage] = useState('');
  const [score, setScore] = useState(post.score ?? 0);
  const [saved, setSaved] = useState(Boolean(post.is_saved));
  const [savingPost, setSavingPost] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [editSpoiler, setEditSpoiler] = useState(post.is_spoiler);
  const [savingEdit, setSavingEdit] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const refreshPost = async () => {
    try { onUpdated?.(await apiRequest(`${endpoint}/${post.id}`)); }
    catch (error) { setMessage(error.message); }
  };
  const edit = async (event) => {
    event.preventDefault();
    setSavingEdit(true);
    try {
      const updated = await apiRequest(`${endpoint}/${post.id}`, { method: 'PATCH', body: JSON.stringify({ title: editTitle, content: editContent, isSpoiler: editSpoiler }) });
      onUpdated?.(updated);
      setRevealed(!updated.is_spoiler);
      setEditing(false);
      setMessage('Đã cập nhật bài viết');
    } catch (error) { setMessage(error.message); }
    finally { setSavingEdit(false); }
  };
  const vote = async (value) => {
    try { const result = await apiRequest(`${endpoint}/${post.id}/vote`, { method: 'PUT', body: JSON.stringify({ value }) }); setScore(result.score); setMessage('Đã cập nhật bình chọn'); }
    catch (error) { setMessage(error.message); }
  };
  const save = async () => {
    if (savingPost) return;
    setSavingPost(true);
    try { await apiRequest(`${endpoint}/${post.id}/save`, { method: saved ? 'DELETE' : 'PUT' }); setSaved(!saved); setMessage(saved ? 'Đã bỏ lưu bài viết' : 'Đã lưu bài viết'); if (saved) onUnsave?.(post.id); }
    catch (error) { setMessage(error.message); }
    finally { setSavingPost(false); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/community/posts/${post.id}`); setMessage('Đã sao chép liên kết'); }
    catch { setMessage('Không thể sao chép liên kết'); }
  };
  return <article className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400"><UserAvatar src={post.author?.avatar_url} className="h-7 w-7 rounded-full object-cover" /><span>{post.author?.username || `Thành viên #${post.author_id}`}</span><span>·</span><time>{new Date(post.created_at).toLocaleString('vi-VN')}</time>{post.community_id && <span>· Nhóm #{post.community_id}</span>}</div>
    <Link to={`/community/posts/${post.id}`} className="block text-lg font-semibold text-white hover:text-pink-400">{post.title}</Link>
    {editing && <form onSubmit={edit} className="space-y-2"><label className="block">Tiêu đề<input required maxLength={200} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="block w-full rounded bg-zinc-800 p-2" /></label><label className="block">Nội dung<textarea maxLength={10000} value={editContent} onChange={(event) => setEditContent(event.target.value)} className="block w-full rounded bg-zinc-800 p-2" /></label><label className="flex gap-2"><input type="checkbox" checked={editSpoiler} onChange={(event) => setEditSpoiler(event.target.checked)} />Có nội dung tiết lộ phim</label><button disabled={savingEdit} className="rounded bg-pink-700 px-3 py-1">Lưu thay đổi</button><button type="button" disabled={savingEdit} className="ml-3" onClick={() => { setEditing(false); setEditTitle(post.title); setEditContent(post.content); setEditSpoiler(post.is_spoiler); }}>Hủy</button></form>}
    {!revealed ? <button className="text-amber-300 text-sm" onClick={() => setRevealed(true)}>Nội dung tiết lộ phim — nhấn để xem</button> : <><p className="whitespace-pre-wrap break-words text-zinc-300">{post.content}</p>{post.image_urls?.map((url) => <img key={url} src={url.startsWith('/') ? `${API_URL}${url}` : url} alt="Ảnh trong bài viết" className="max-h-96 rounded-lg object-contain" />)}</>}
    {post.production_id && <Link className="text-sm text-pink-400" to={`/movies/${post.production_id}`}>Phim #{post.production_id}</Link>}
    {post.type === 'screenshot' && post.episode_id && <Link className="block text-sm text-pink-400" to={`/watch-episode/${post.episode_id}?pos=${Math.floor(post.timestamp_seconds || 0)}`}>Tập #{post.episode_id} · {Math.floor((post.timestamp_seconds || 0) / 60)}:{String(Math.floor((post.timestamp_seconds || 0) % 60)).padStart(2, '0')}</Link>}
    <div className="flex flex-wrap gap-4 text-sm text-zinc-400"><span>Điểm {score}</span>{user && <><button onClick={() => vote(1)}>Ủng hộ</button><button onClick={() => vote(-1)}>Không ủng hộ</button><button onClick={() => vote(0)}>Bỏ bình chọn</button></>}<span>{post.comment_count ?? 0} bình luận</span><button onClick={share}>Chia sẻ</button>{user && <button onClick={save} disabled={savingPost}>{saved ? 'Bỏ lưu' : 'Lưu'}</button>}{user?.id === post.author_id && <><button onClick={() => setEditing(true)}>Sửa</button><button onClick={() => onDelete(post.id)} className="text-red-400">Xóa</button></>}</div>
    <button type="button" onClick={() => setCommentsOpen((open) => !open)} className="text-sm text-pink-400">{commentsOpen ? 'Ẩn bình luận' : 'Xem bình luận'}</button>
    {commentsOpen && <PostComments postId={post.id} user={user} onChanged={refreshPost} />}
    {message && <p role="status" className="text-xs text-zinc-400">{message}</p>}
  </article>;
}

export default function CommunityPage({ view = 'feed' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [productionId, setProductionId] = useState('');
  const [episodeId, setEpisodeId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [tags, setTags] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const path = view === 'detail' ? `${endpoint}/${id}` : view === 'saved' ? `${endpoint}/saved` : `${endpoint}?sort=${sort}&page=${page}`;
      const result = await apiRequest(path);
      setPosts(view === 'detail' ? [result] : result.items || []); setHasMore(Boolean(result.hasMore));
    } catch (err) { setError(err.message); setPosts([]); }
    finally { setLoading(false); }
  }, [view, id, page, sort]);
  useEffect(() => { if (view !== 'create') load(); }, [load, view]);
  const submit = async (event) => {
    event.preventDefault(); setSending(true); setError('');
    try {
      const post = { title, content, isSpoiler: spoiler,
        ...(productionId && { productionId: Number(productionId) }),
        ...(episodeId && { episodeId: Number(episodeId) }),
        ...(communityId && { communityId: Number(communityId) }),
        ...(tags.trim() && { tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
      };
      let result;
      if (files.length) {
        const form = new FormData(); form.append('post', JSON.stringify(post)); files.forEach((file) => form.append('images', file));
        result = await apiRequest(`${endpoint}/with-images`, { method: 'POST', body: form });
      } else result = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(post) });
      navigate(`/community/posts/${result.id}`);
    } catch (err) { setError(err.message); } finally { setSending(false); }
  };
  const remove = async (postId) => {
    try { await apiRequest(`${endpoint}/${postId}`, { method: 'DELETE' }); if (view === 'detail') navigate('/community'); else await load(); }
    catch (err) { setError(err.message); }
  };
  const updatePost = (updated) => setPosts((items) => items.map((item) => item.id === updated.id ? updated : item));
  return <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8"><div className="mx-auto max-w-7xl grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)_230px]">
    <aside className="space-y-3 text-sm"><h2 className="font-bold text-lg">Movie Community</h2><nav className="flex flex-wrap lg:flex-col gap-3"><Link to="/community">Bảng tin</Link><Link to="/community/create">Viết bài</Link><Link to="/community/saved">Bài đã lưu</Link></nav></aside>
    <section className="min-w-0 space-y-4"><div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">{view === 'create' ? 'Tạo bài viết' : view === 'saved' ? 'Bài viết đã lưu' : view === 'detail' ? 'Bài viết' : 'Bảng tin phim'}</h1>{view === 'feed' && <Link className="rounded-lg bg-pink-700 px-4 py-2 text-sm" to="/community/create">Viết bài</Link>}</div>
      {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {view === 'create' ? !user ? <p>Vui lòng <Link className="text-pink-400" to="/login">đăng nhập</Link> để viết bài.</p> : <form onSubmit={submit} className="space-y-4 rounded-xl bg-zinc-900 p-5"><label className="block">Tiêu đề<input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 p-3" /></label><label className="block">Nội dung<textarea maxLength={10000} value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 p-3" /></label><PostMetadata productionId={productionId} setProductionId={setProductionId} episodeId={episodeId} setEpisodeId={setEpisodeId} communityId={communityId} setCommunityId={setCommunityId} tags={tags} setTags={setTags} /><label className="block">Ảnh (tối đa 5 ảnh, 5 MB mỗi ảnh)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 5))} className="block mt-2 text-sm" /></label><label className="flex gap-2"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />Có nội dung tiết lộ phim</label><button disabled={sending} className="rounded bg-pink-700 px-5 py-2 disabled:opacity-50">{sending ? 'Đang đăng...' : 'Đăng bài'}</button></form> : <>{view === 'feed' && <select aria-label="Sắp xếp bài viết" className="rounded bg-zinc-800 p-2" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="newest">Mới nhất</option><option value="popular">Phổ biến</option><option value="hot">Đang nổi bật</option></select>}{loading ? <p>Đang tải...</p> : posts.length ? posts.map((post) => <PostCard key={post.id} post={post} user={user} onDelete={remove} onUpdated={updatePost} onUnsave={view === 'saved' ? (id) => setPosts((items) => items.filter((item) => item.id !== id)) : undefined} />) : !error && <p className="text-zinc-400">Chưa có bài viết.</p>}{view === 'feed' && <div className="flex gap-4"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Trang trước</button><span>Trang {page}</span><button disabled={!hasMore} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Trang sau</button></div>}</>}
    </section><aside className="hidden lg:block rounded-xl border border-zinc-800 bg-zinc-900 p-5 h-fit"><h2 className="font-semibold">Cộng đồng phim</h2><p className="mt-2 text-sm text-zinc-400">Chia sẻ cảm nhận và những khoảnh khắc yêu thích của bạn.</p></aside>
  </div></main>;
}
