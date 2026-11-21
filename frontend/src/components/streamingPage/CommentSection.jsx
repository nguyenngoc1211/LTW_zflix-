import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { apiRequest } from '../../services/api.js';
import { CommentForm, CommentPagination } from '../community/UnifiedComment.jsx';
import { commentPayload, commentRequestHeaders, clearCommentRequest } from '../../utils/commentRequest.js';
import { PostCard } from '../../modules/community/CommunityPage.jsx';
import MovieCommentItem from './MovieCommentItem.jsx';

export default function CommentSection({ productionId, episodeId, showLegacy = false }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const targetId = Number(params.get('commentId'));
  const [page, setPage] = useState(1);
  const [comments, setComments] = useState([]);
  const [legacy, setLegacy] = useState([]);
  const [targetPath, setTargetPath] = useState([]);
  const [targetPages, setTargetPages] = useState({});
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const pendingComment = useRef(null);
  const base = `/api/v1/productions/${productionId}/comments`;
  const load = useCallback(async () => {
    if (!productionId) return;
    const query = new URLSearchParams({ parentId: 'root', page: String(page), limit: '20', ...(episodeId && { episodeId: String(episodeId) }) });
    const [movie, scenes] = await Promise.all([
      apiRequest(`${base}?${query}`),
      showLegacy ? apiRequest(`/api/v1/scene-questions?movieId=${productionId}${episodeId ? `&episodeId=${episodeId}` : ''}&page=${page}&limit=20`) : Promise.resolve({ items: [], hasMore: false }),
    ]);
    setComments(movie.items || []);
    setLegacy(scenes.items || []);
    setMore(Boolean(movie.hasMore || scenes.hasMore));
    setError('');
  }, [productionId, episodeId, page, showLegacy, base]);
  useEffect(() => { let active = true; setLoading(true); load().catch((cause) => { if (active) setError(cause.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load, user?.id]);
  useEffect(() => {
    if (!productionId || !targetId) return undefined;
    let active = true;
    const query = episodeId ? `?episodeId=${episodeId}` : '';
    apiRequest(`${base}${query}`).then((data) => {
      if (!active) return;
      const all = data.items || [];
      const byId = new Map(all.map((item) => [item.id, item]));
      const path = [];
      let node = byId.get(targetId);
      while (node && !path.includes(node.id)) { path.unshift(node.id); node = byId.get(node.parent_id); }
      if (!path.length) return;
      const pages = {};
      path.forEach((id) => {
        const item = byId.get(id);
        const siblings = all.filter((candidate) => (candidate.parent_id ?? null) === (item.parent_id ?? null))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
        pages[item.parent_id ?? 'root'] = Math.floor(siblings.findIndex((candidate) => candidate.id === id) / 20) + 1;
      });
      setTargetPath(path.slice(0, -1)); setTargetPages(pages); setPage(pages.root || 1);
    }).catch(() => {});
    return () => { active = false; };
  }, [productionId, episodeId, targetId, base]);
  useEffect(() => {
    if (!targetId) return undefined;
    const scroll = () => document.getElementById(`movie-comment-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const observer = new MutationObserver(() => { if (document.getElementById(`movie-comment-${targetId}`)) { scroll(); observer.disconnect(); } });
    observer.observe(document.body, { childList: true, subtree: true });
    scroll();
    return () => observer.disconnect();
  }, [targetId, comments]);
  const submit = async (event) => {
    event.preventDefault(); if (busy || (!text.trim() && !imageFile)) return;
    setBusy(true); setError(''); setWarning('');
    try {
      const { body, signature } = commentPayload({ content: text, imageFile, isSpoiler: false, ...(episodeId && { episodeId }) });
      const result = await apiRequest(base, { method: 'POST', body, headers: commentRequestHeaders(pendingComment, signature) });
      clearCommentRequest(pendingComment);
      setText(''); setImageFile(null); setWarning(result.warning || '');
      if (page === 1) await load(); else setPage(1);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const removeScene = async (id) => { const scene = legacy.find((item) => item.id === id); await apiRequest(`/api/v1/${scene?.content_type === 'scene_question' ? 'scene-questions' : 'community/posts'}/${id}`, { method: 'DELETE' }); await load(); };
  const entries = [...comments.map((item) => ({ type: 'movie', item })), ...legacy.map((item) => ({ type: 'scene', item }))].sort((a, b) => new Date(b.item.created_at) - new Date(a.item.created_at));
  if (!productionId) return null;
  return <section className="movie-unified-discussion"><h3>Bình luận</h3>
    {user ? <CommentForm onSubmit={submit} text={text} onText={setText} imageFile={imageFile} onImageFile={setImageFile} busy={busy} label="Viết bình luận hoặc dán ảnh..." /> : <p className="movie-discussion-login"><Link to="/login">Đăng nhập</Link> để tham gia bình luận.</p>}
    {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}{warning && <p role="status" className="toxic-comment-notice">{warning}</p>}
    {loading ? <p className="text-zinc-400 text-sm">Đang tải bình luận...</p> : entries.length ? <div className="movie-unified-list">{entries.map(({ type, item }) => type === 'movie' ? <MovieCommentItem key={`movie:${item.id}`} comment={item} productionId={productionId} episodeId={episodeId} onChanged={load} targetPath={targetPath} targetPages={targetPages} /> : <div className="movie-legacy-scene" key={`scene:${item.id}`}><span>Câu hỏi khoảnh khắc trước đây</span><PostCard post={item} user={user} onDelete={removeScene} onUpdated={load} compact /></div>)}</div> : <p className="text-zinc-400 text-sm">Chưa có bình luận.</p>}
    {(page > 1 || more) && <CommentPagination page={page} more={more} onPage={setPage} />}
  </section>;
}
