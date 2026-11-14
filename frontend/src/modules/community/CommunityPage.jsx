import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { apiRequest, API_URL } from '../../services/api.js';
import PostComments from './PostComments.jsx';
import UserAvatar from '../../components/UserAvatar.jsx';
import VipIdentity from '../../components/VipIdentity.jsx';
import { vipAvatarClass } from '../../components/vipIdentity.js';
import { CommentActions } from '../../components/community/UnifiedComment.jsx';
import { MentionText } from '../../components/community/MentionTextarea.jsx';
import CommunityComposer from './CommunityComposer.jsx';
import { FiArrowDown, FiArrowUp, FiBookmark, FiEdit3, FiHome, FiMessageCircle, FiMoreHorizontal, FiSearch, FiShare2, FiTrendingUp, FiUser } from 'react-icons/fi';
import './community-feed.css';

const endpoint = '/api/v1/community/posts';

export function PostCard({ post, user, onDelete, onUpdated, onUnsave, compact = false }) {
  const [searchParams] = useSearchParams();
  const scene = post.content_type === 'scene_question';
  const postEndpoint = scene ? '/api/v1/scene-questions' : endpoint;
  const [revealed, setRevealed] = useState(!post.is_spoiler);
  const [message, setMessage] = useState('');
  const [upvotes, setUpvotes] = useState(post.upvotes ?? 0);
  const [downvotes, setDownvotes] = useState(post.downvotes ?? 0);
  const [postVote, setPostVote] = useState(post.viewer_vote ?? 0);
  const [voteBusy, setVoteBusy] = useState(false);
  const votePending = useRef(false);
  const [saved, setSaved] = useState(Boolean(post.is_saved));
  const [savingPost, setSavingPost] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [editSpoiler, setEditSpoiler] = useState(post.is_spoiler);
  const [savingEdit, setSavingEdit] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(Boolean(searchParams.get('commentId')));
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [pollCounts, setPollCounts] = useState(post.poll_counts || []);
  const [pollChoice, setPollChoice] = useState(post.viewer_poll_option ?? null);
  const [pollBusy, setPollBusy] = useState(false);
  const [lightbox, setLightbox] = useState('');
  const votePoll = async (option) => {
    if (!user) { setMessage('Vui lòng đăng nhập để bình chọn'); return; }
    setPollBusy(true);
    try { const result = await apiRequest(`/api/v1/community/posts/${post.id}/poll-vote`, { method: 'PUT', body: JSON.stringify({ option }) }); setPollCounts(result.poll_counts); setPollChoice(option); }
    catch (error) { setMessage(error.message); }
    finally { setPollBusy(false); }
  };
  const report = async (event) => {
    event.preventDefault();
    try { await apiRequest(`${postEndpoint}/${post.id}/reports`, { method: 'POST', body: JSON.stringify({ reason: reportReason, description: reportDescription }) }); setReporting(false); setMessage('Đã gửi báo cáo'); }
    catch (error) { setMessage(error.message); }
  };
  const refreshPost = async () => {
    try { onUpdated?.(await apiRequest(`${postEndpoint}/${post.id}`)); }
    catch (error) { setMessage(error.message); }
  };
  const edit = async (event) => {
    event.preventDefault();
    setSavingEdit(true);
    try {
      const updated = await apiRequest(`${postEndpoint}/${post.id}`, { method: 'PATCH', body: JSON.stringify({ title: editTitle, content: editContent, isSpoiler: editSpoiler }) });
      onUpdated?.(updated);
      setRevealed(!updated.is_spoiler);
      setEditing(false);
      setMessage('Đã cập nhật bài viết');
    } catch (error) { setMessage(error.message); }
    finally { setSavingEdit(false); }
  };
  const vote = async (value) => {
    if (votePending.current) return;
    votePending.current = true; setVoteBusy(true);
    try { const result = await apiRequest(`${postEndpoint}/${post.id}/vote`, { method: 'PUT', body: JSON.stringify({ value: postVote === value ? 0 : value }) }); setUpvotes(result.upvotes); setDownvotes(result.downvotes); setPostVote(result.value); setMessage('Đã cập nhật bình chọn'); }
    catch (error) { setMessage(error.message); }
    finally { votePending.current = false; setVoteBusy(false); }
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
  if (!scene && !compact) return <article className="community-card">
    <header className="community-card-head"><Link to={`/community/users/${post.author_id}`}><UserAvatar src={post.author?.avatar_url} className={`community-avatar ${vipAvatarClass(post.author?.vip_expires_at)}`} /></Link><div className="community-author"><Link to={`/community/users/${post.author_id}`}><VipIdentity username={post.author?.username || `Thành viên #${post.author_id}`} vipExpiresAt={post.author?.vip_expires_at} /></Link><span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString('vi-VN')}</time>{post.community_id ? ` · Nhóm #${post.community_id}` : ''}</span></div><span className="community-category">{{ review: 'Review', discussion: 'Thảo luận', question: 'Hỏi đáp', news: 'Tin tức', meme: 'Meme', poll: 'Poll' }[post.category] || 'Thảo luận'}</span></header>
    <div className="community-card-body">
      <Link to={`/community/posts/${post.id}`} className="community-card-title">{post.title}</Link>
      {editing && <form onSubmit={edit} className="community-edit"><label>Tiêu đề<input required maxLength={200} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></label><label>Nội dung<textarea maxLength={10000} value={editContent} onChange={(event) => setEditContent(event.target.value)} /></label><label><input type="checkbox" checked={editSpoiler} onChange={(event) => setEditSpoiler(event.target.checked)} /> Có spoiler</label><div><button disabled={savingEdit}>Lưu thay đổi</button><button type="button" onClick={() => setEditing(false)}>Hủy</button></div></form>}
      {!revealed ? <button type="button" className="community-more" onClick={() => setRevealed(true)}>Hiện nội dung spoiler</button> : <>{post.content && <><div className={`community-content ${!expanded ? 'community-content-clamped' : ''}`}><MentionText text={post.content} /></div>{!expanded && post.content.length > 150 && <button type="button" className="community-more" onClick={() => setExpanded(true)}>Xem thêm</button>}</>}{post.is_spoiler && <button type="button" className="community-more" onClick={() => setRevealed(false)}>Ẩn spoiler</button>}</>}
      {post.production_id && <Link className="community-movie" to={`/movies/${post.production_id}`}>{post.production?.poster_url && <img src={post.production.poster_url} alt="" loading="lazy" />}<span>{post.production?.title || `Phim #${post.production_id}`}{post.rating && <small>★ {Number(post.rating).toFixed(1)}/5</small>}</span></Link>}
      {post.image_urls?.length > 0 && revealed && <div className="community-image-grid">{post.image_urls.map((url) => { const src = url.startsWith('/') ? `${API_URL}${url}` : url; return <button type="button" key={url} onClick={() => setLightbox(src)} aria-label="Mở ảnh đầy đủ"><img src={src} alt="Ảnh trong bài viết" loading="lazy" /></button>; })}</div>}
      {post.poll_options && <div className="community-poll">{post.poll_options.map((option, index) => <button key={index} type="button" disabled={pollBusy} aria-pressed={pollChoice === index} onClick={() => votePoll(index)} className={pollChoice === index ? 'selected' : ''}><span>{option}</span><small>{pollCounts[index] || 0} phiếu</small></button>)}</div>}
      {post.type === 'screenshot' && post.episode_id && <Link className="community-more" to={`/watch-episode/${post.episode_id}?pos=${Math.floor(post.timestamp_seconds || 0)}`}>Xem khoảnh khắc · {Math.floor((post.timestamp_seconds || 0) / 60)}:{String(Math.floor((post.timestamp_seconds || 0) % 60)).padStart(2, '0')}</Link>}
    </div>
    <footer className="community-actions"><div className="community-votes"><button type="button" aria-label="Ủng hộ" aria-pressed={postVote === 1} disabled={voteBusy || !user} onClick={() => vote(1)}><FiArrowUp /></button><span title={`${upvotes} ủng hộ, ${downvotes} không ủng hộ`}>{upvotes - downvotes}</span><button type="button" aria-label="Không ủng hộ" aria-pressed={postVote === -1} disabled={voteBusy || !user} onClick={() => vote(-1)}><FiArrowDown /></button></div><button type="button" onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen} aria-label="Bình luận"><FiMessageCircle /><span>{post.comment_count ?? 0}</span></button><button type="button" onClick={save} disabled={!user || savingPost} aria-label={saved ? 'Bỏ lưu' : 'Lưu bài'} aria-pressed={saved}><FiBookmark /><span className="community-action-label">{saved ? 'Đã lưu' : 'Lưu'}</span></button><button type="button" onClick={share} aria-label="Chia sẻ"><FiShare2 /><span className="community-action-label">Chia sẻ</span></button><details className="community-menu"><summary aria-label="Tùy chọn bài viết"><FiMoreHorizontal /></summary><div>{user?.id === post.author_id && <><button type="button" onClick={(event) => { setEditing(true); event.currentTarget.closest('details').removeAttribute('open'); }}>Sửa</button><button type="button" onClick={() => onDelete(post.id)}>Xóa</button></>}<button type="button" onClick={() => setReporting(true)}>Báo xấu</button></div></details></footer>
    {reporting && <form className="movie-reply-form" onSubmit={report}><label>Lý do<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Quấy rối</option><option value="spoiler">Spoiler</option><option value="other">Khác</option></select></label><label>Mô tả<textarea maxLength={1000} value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} /></label><div className="movie-comment-actions"><button type="submit">Gửi báo cáo</button><button type="button" onClick={() => setReporting(false)}>Hủy</button></div></form>}
    {commentsOpen && <div className="community-comments"><PostComments postId={post.id} user={user} onChanged={refreshPost} /></div>}
    {message && <p role="status" className="community-status">{message}</p>}
    {lightbox && <div className="community-lightbox" role="dialog" aria-modal="true" aria-label="Ảnh đầy đủ" onClick={() => setLightbox('')}><button type="button" aria-label="Đóng ảnh" onClick={() => setLightbox('')}>×</button><img src={lightbox} alt="Ảnh đầy đủ" onClick={(event) => event.stopPropagation()} /></div>}
  </article>;
  return <article className={compact ? 'movie-post rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-3' : 'rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-3'}>
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400"><UserAvatar src={post.author?.avatar_url} className={`${compact ? 'movie-comment-avatar' : 'h-7 w-7 rounded-full object-cover'} ${vipAvatarClass(post.author?.vip_expires_at)}`} /><VipIdentity username={post.author?.username || `Thành viên #${post.author_id}`} vipExpiresAt={post.author?.vip_expires_at} /><span>·</span><time>{new Date(post.created_at).toLocaleString('vi-VN')}</time>{post.community_id && <span>· Nhóm #{post.community_id}</span>}</div>
    {!scene && <span className="inline-block rounded-full border border-red-800 bg-red-950 px-2 py-1 text-xs text-red-200">{{ review: 'Review', discussion: 'Thảo luận', question: 'Hỏi đáp', news: 'Tin tức', meme: 'Meme' }[post.category] || 'Thảo luận'}</span>}
    {scene ? <h3 className="text-lg font-semibold text-white">{post.title}</h3> : <Link to={`/community/posts/${post.id}`} className="block text-lg font-semibold text-white hover:text-red-400">{post.title}</Link>}
    {editing && <form onSubmit={edit} className="space-y-2"><label className="block">{scene ? 'Câu hỏi' : 'Tiêu đề'}<input required maxLength={200} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="block w-full rounded bg-zinc-800 p-2" /></label>{!scene && <><label className="block">Nội dung<textarea maxLength={10000} value={editContent} onChange={(event) => setEditContent(event.target.value)} className="block w-full rounded bg-zinc-800 p-2" /></label></>}<button disabled={savingEdit} className="rounded bg-pink-700 px-3 py-1">Lưu thay đổi</button><button type="button" disabled={savingEdit} className="ml-3" onClick={() => { setEditing(false); setEditTitle(post.title); setEditContent(post.content); setEditSpoiler(post.is_spoiler); }}>Hủy</button></form>}
    {!revealed ? <button type="button" className="post-spoiler-toggle text-amber-300 text-sm" onClick={() => setRevealed(true)}>Nội dung tiết lộ phim — nhấn để xem</button> : <><div className={`whitespace-pre-wrap break-words text-zinc-300 ${!compact && !expanded ? 'line-clamp-4' : ''}`}><MentionText text={post.content} /></div>{!compact && !expanded && post.content?.length > 240 && <button type="button" className="text-sm font-medium text-red-400" onClick={() => setExpanded(true)}>Đọc tiếp</button>}{post.image_urls?.map((url) => <img key={url} src={url.startsWith('/') ? `${API_URL}${url}` : url} alt="Ảnh trong bài viết" className="max-h-96 w-full rounded-lg object-contain" />)}{post.is_spoiler && <button type="button" className="post-spoiler-toggle text-amber-300 text-sm" onClick={() => setRevealed(false)}>Ẩn nội dung spoiler</button>}</>}
    {!scene && post.rating && <p className="font-semibold text-amber-400">★ {post.rating.toFixed(1)}/5</p>}
    {!scene && post.production?.poster_url && <img src={post.production.poster_url} alt={post.production.title} className="h-36 w-24 rounded object-cover" loading="lazy" />}
    {!scene && post.poll_options && <div className="space-y-2">{post.poll_options.map((option, index) => <button key={index} type="button" disabled={pollBusy} aria-pressed={pollChoice === index} onClick={() => votePoll(index)} className="flex w-full justify-between rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-left text-sm disabled:opacity-75"><span>{option}</span><span>{pollCounts[index] || 0} phiếu</span></button>)}</div>}
    {post.production_id && <Link className="text-sm text-red-400" to={`/movies/${post.production_id}`}>{post.production?.title || `Phim #${post.production_id}`}</Link>}
    {post.type === 'screenshot' && post.episode_id && <Link className="block text-sm text-pink-400" to={`/watch-episode/${post.episode_id}?pos=${Math.floor(post.timestamp_seconds || 0)}`}>Tập #{post.episode_id} · {Math.floor((post.timestamp_seconds || 0) / 60)}:{String(Math.floor((post.timestamp_seconds || 0) % 60)).padStart(2, '0')}</Link>}
    <CommentActions user={user} upvotes={upvotes} downvotes={downvotes} vote={postVote} voteBusy={voteBusy} onVote={vote} menuItems={user?.id === post.author_id ? [{ label: 'Sửa', action: () => setEditing(true) }, { label: 'Xóa', action: () => onDelete(post.id) }] : scene ? [{ label: 'Báo xấu', action: () => setReporting(true) }] : []}><button type="button" onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen}>{commentsOpen ? 'Ẩn bình luận' : `${scene ? 'Trả lời' : 'Xem bình luận'} (${post.comment_count ?? 0})`}</button>{!scene && <button type="button" onClick={share}>Chia sẻ</button>}{user && !scene && <button type="button" onClick={save} disabled={savingPost}>{saved ? 'Bỏ lưu' : 'Lưu'}</button>}</CommentActions>
    {reporting && <form className="movie-reply-form" onSubmit={report}><label>Lý do<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Quấy rối</option><option value="spoiler">Spoiler</option><option value="other">Khác</option></select></label><label>Mô tả<textarea maxLength={1000} value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} /></label><div className="movie-comment-actions"><button type="submit">Gửi báo cáo</button><button type="button" onClick={() => setReporting(false)}>Hủy</button></div></form>}
    {commentsOpen && <PostComments postId={post.id} user={user} onChanged={refreshPost} hideSpoilerOption={compact} scene={scene} />}
    {message && <p role="status" className="text-xs text-zinc-400">{message}</p>}
  </article>;
}

export default function CommunityPage({ view = 'feed', scene = false }) {
  const endpoint = scene ? '/api/v1/scene-questions' : '/api/v1/community/posts';
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [sort, setSort] = useState('newest');
  const [feedMode, setFeedMode] = useState('explore');
  const [followingCount, setFollowingCount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const path = view === 'detail' ? `${endpoint}/${id}` : view === 'saved' ? `${endpoint}/saved` : `${endpoint}?${new URLSearchParams({ sort: feedMode === 'following' ? 'newest' : sort, page: String(page), ...(feedMode === 'following' && { following: 'true' }), ...(categoryFilter && { category: categoryFilter }), ...(query && { search: query }) })}`;
      const result = await apiRequest(path);
      setPosts(view === 'detail' ? [result] : result.items || []); setHasMore(Boolean(result.hasMore));
    } catch (err) { setError(err.message); setPosts([]); }
    finally { setLoading(false); }
  }, [view, id, page, sort, feedMode, categoryFilter, query, endpoint]);
  useEffect(() => { if (view !== 'create') load(); }, [load, view, user?.id]);
  useEffect(() => {
    if (scene) return;
    let active = true;
    apiRequest('/api/v1/community/posts?sort=trending&limit=5').then((result) => { if (active) setTrendingPosts(result.items || []); }).catch(() => { if (active) setTrendingPosts([]); });
    return () => { active = false; };
  }, [scene]);
  useEffect(() => {
    if (!user?.id || view !== 'feed') return;
    apiRequest(`/api/v1/community/users/${user.id}`).then((result) => setFollowingCount(result.counts?.following || 0)).catch(() => setFollowingCount(0));
  }, [user?.id, view, feedMode]);
  const remove = async (postId) => {
    try { await apiRequest(`${endpoint}/${postId}`, { method: 'DELETE' }); if (view === 'detail') navigate('/community'); else await load(); }
    catch (err) { setError(err.message); }
  };
  const updatePost = (updated) => setPosts((items) => items.map((item) => item.id === updated.id ? updated : item));
  return <main className="community-page"><div className="community-layout">
    <aside className="community-left"><div className="community-brand"><span>Z</span><div><strong>CỘNG ĐỒNG</strong><small>ZFLIX</small></div></div><nav aria-label="Điều hướng cộng đồng"><Link className={view === 'feed' ? 'active' : ''} to="/community"><FiHome />Bảng tin</Link><Link className={view === 'create' ? 'active' : ''} to="/community/create"><FiEdit3 />Viết bài</Link><Link className={view === 'saved' ? 'active' : ''} to="/community/saved"><FiBookmark />Bài đã lưu</Link>{user && <Link to={`/community/users/${user.id}`}><FiUser />Hồ sơ của tôi</Link>}</nav><div className="community-left-note"><FiTrendingUp /><span>Khám phá những cuộc trò chuyện phim đang được quan tâm.</span></div></aside>
    <section className="community-main"><div className="community-heading"><div><span>KHÔNG GIAN PHIM ẢNH</span><h1>{view === 'create' ? 'Tạo bài viết' : view === 'saved' ? 'Bài đã lưu' : view === 'detail' ? 'Bài viết' : 'Bảng tin'}</h1></div>{view === 'feed' && <Link className="community-create" to="/community/create"><FiEdit3 /> Viết bài</Link>}</div>
      {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {view === 'feed' && <div className="community-feed-modes" role="group" aria-label="Chọn bảng tin"><button type="button" aria-pressed={feedMode === 'explore'} onClick={() => { setFeedMode('explore'); setPage(1); setQuery(''); setCategoryFilter(''); }}>Khám phá</button><button type="button" aria-pressed={feedMode === 'following'} onClick={() => { setFeedMode('following'); setPage(1); setQuery(''); setCategoryFilter(''); }}>Đang theo dõi</button></div>}
      {view === 'create' ? !user ? <p>Vui lòng <Link className="text-red-400" to="/login">đăng nhập</Link> để viết bài.</p> : <CommunityComposer /> : <>{view === 'feed' && feedMode === 'explore' && <div className="community-discovery"><div className="community-search-row"><form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><FiSearch /><input aria-label="Tìm bài viết" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm bài viết, nội dung, tên phim..." /><button type="submit">Tìm</button></form><select aria-label="Sắp xếp bài viết" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="newest">Mới nhất</option><option value="popular">Phổ biến</option><option value="trending">Trending</option><option value="hot">Trong tuần</option></select></div><div className="community-tabs" role="group" aria-label="Lọc loại bài">{[['', 'Tất cả'], ['review', 'Review'], ['discussion', 'Thảo luận'], ['question', 'Hỏi đáp'], ['news', 'Tin tức'], ['meme', 'Meme'], ['poll', 'Poll']].map(([value, label]) => <button type="button" key={value} className={categoryFilter === value ? 'active' : ''} aria-pressed={categoryFilter === value} onClick={() => { setCategoryFilter(value); setPage(1); }}>{label}</button>)}</div></div>}{loading ? <p className="community-empty">Đang tải...</p> : posts.length ? <div className="community-posts">{posts.map((post) => <PostCard key={`${post.id}:${user?.id ?? 'guest'}`} post={post} user={user} onDelete={remove} onUpdated={updatePost} onUnsave={view === 'saved' ? (id) => setPosts((items) => items.filter((item) => item.id !== id)) : undefined} />)}</div> : !error && <p className="community-empty">{feedMode === 'following' ? followingCount === 0 ? 'Bạn chưa theo dõi ai. Mở hồ sơ tác giả ở mục Khám phá để theo dõi.' : 'Người bạn theo dõi chưa có bài viết phù hợp.' : 'Chưa có bài viết.'}</p>}{view === 'feed' && <div className="community-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>← Trang trước</button><span>Trang {page}</span><button disabled={!hasMore} onClick={() => setPage(page + 1)}>Trang sau →</button></div>}</>}
    </section><aside className="community-right"><div className="community-trending"><div className="community-trending-heading"><FiTrendingUp /><h2>Đang thịnh hành</h2></div>{trendingPosts.length ? <ol>{trendingPosts.map((post, index) => <li key={post.id}><span>{String(index + 1).padStart(2, '0')}</span><div><Link to={`/community/posts/${post.id}`}>{post.title}</Link><small>{post.comment_count ?? 0} bình luận · {(post.upvotes ?? 0) - (post.downvotes ?? 0)} điểm</small></div></li>)}</ol> : <p>Chưa có bài thịnh hành.</p>}</div></aside>
  </div></main>;
}
