import { useCallback, useEffect, useRef, useState } from 'react';
import { CommentActions, CommentForm, CommentFrame, CommentPagination, SpoilerContent } from '../community/UnifiedComment.jsx';
import ToxicComment from '../community/ToxicComment.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { apiRequest } from '../../services/api.js';

export default function MovieCommentItem({ comment, productionId, depth = 0 }) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [count, setCount] = useState(comment.reply_count || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [upvotes, setUpvotes] = useState(comment.upvotes ?? 0);
  const [downvotes, setDownvotes] = useState(comment.downvotes ?? 0);
  const [vote, setVote] = useState(comment.viewer_vote || 0);
  const [voteBusy, setVoteBusy] = useState(false);
  const votePending = useRef(false);
  const [spoiler] = useState(Boolean(comment.is_spoiler));
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [removed, setRemoved] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const endpoint = `/api/v1/productions/${productionId}/comments`;
  const load = useCallback(async (targetPage) => {
    const data = await apiRequest(`${endpoint}?parentId=${comment.id}&page=${targetPage}&limit=10`);
    setItems(data.items); setMore(data.hasMore); setError('');
  }, [endpoint, comment.id]);
  useEffect(() => {
    if (!expanded) return undefined;
    let active = true;
    apiRequest(`${endpoint}?parentId=${comment.id}&page=${page}&limit=10`).then((data) => {
      if (active) { setItems(data.items); setMore(data.hasMore); setError(''); }
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [endpoint, comment.id, expanded, page]);
  const saveVote = async (value) => {
    if (votePending.current) return;
    votePending.current = true; setVoteBusy(true);
    try { const result = await apiRequest(`/api/v1/comments/${comment.id}/vote`, { method: 'PUT', body: JSON.stringify({ value: vote === value ? 0 : value }) }); setUpvotes(result.upvotes); setDownvotes(result.downvotes); setVote(result.value); }
    catch (err) { setError(err.message); }
    finally { votePending.current = false; setVoteBusy(false); }
  };
  const saveEdit = async (event) => {
    event.preventDefault();
    try { await apiRequest(`/api/v1/comments/${comment.id}`, { method: 'PATCH', body: JSON.stringify({ content, isSpoiler: spoiler }) }); setEditing(false); }
    catch (err) { setError(err.message); }
  };
  const remove = async () => {
    try { await apiRequest(`/api/v1/comments/${comment.id}`, { method: 'DELETE' }); setRemoved(true); }
    catch (err) { setError(err.message); }
  };
  const report = async (event) => {
    event.preventDefault();
    try { await apiRequest(`/api/v1/comments/${comment.id}/reports`, { method: 'POST', body: JSON.stringify({ reason, description }) }); setReporting(false); setError('Đã gửi báo cáo.'); }
    catch (err) { setError(err.message); }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify({ content: text.trim(), parentId: comment.id, isSpoiler: false }) });
      setText(''); setReplying(false); setCount((value) => value + 1);
      if (expanded && page === 1) await load(1); else { setPage(1); setExpanded(true); }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <CommentFrame avatar={comment.avatar_url} username={comment.username || `Thành viên #${comment.user_id}`} date={comment.created_at}>
      {removed ? <p className="movie-comment-content">[Đã xóa]</p> : editing ? <form onSubmit={saveEdit} className="movie-reply-form"><textarea value={content} onChange={(event) => setContent(event.target.value)} required maxLength={3000} /><div className="movie-comment-actions"><button type="submit">Lưu</button><button type="button" onClick={() => { setEditing(false); setContent(comment.content); }}>Hủy</button></div></form> : <SpoilerContent spoiler={spoiler}><ToxicComment content={content} isToxic={Boolean(Number(comment.is_toxic))} className="movie-comment-content" /></SpoilerContent>}
      {!removed && <CommentActions user={user} upvotes={upvotes} downvotes={downvotes} vote={vote} voteBusy={voteBusy} onVote={saveVote} canReply={depth < 3} onReply={() => setReplying((value) => !value)} menuItems={user?.id === comment.user_id ? [{ label: 'Sửa', action: () => setEditing(true) }, { label: 'Xóa', action: remove }] : [{ label: 'Báo xấu', action: () => setReporting(true) }]}>
        {(count > 0 || expanded) && <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Ẩn trả lời' : `Trả lời (${count})`}</button>}
      </CommentActions>}
      {reporting && <form onSubmit={report} className="movie-reply-form"><label>Lý do<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Quấy rối</option><option value="spoiler">Spoiler</option><option value="other">Khác</option></select></label><label>Mô tả<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="movie-comment-actions"><button type="submit">Gửi báo cáo</button><button type="button" onClick={() => setReporting(false)}>Hủy</button></div></form>}
      {replying && <CommentForm onSubmit={submit} text={text} onText={setText} busy={busy} onCancel={() => setReplying(false)} label={`Trả lời ${comment.username || `thành viên #${comment.user_id}`}`} />}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {expanded && <div className="movie-replies">{items.map((item) => <MovieCommentItem key={item.id} comment={item} productionId={productionId} depth={depth + 1} />)}
        {(page > 1 || more) && <CommentPagination page={page} more={more} onPage={setPage} />}
      </div>}
  </CommentFrame>;
}
