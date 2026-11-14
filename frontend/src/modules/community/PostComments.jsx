import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { CommentActions, CommentForm, CommentFrame, CommentPagination, SpoilerContent } from '../../components/community/UnifiedComment.jsx';
import { useSearchParams } from 'react-router-dom';
import { commentRequestHeaders, clearCommentRequest } from '../../utils/commentRequest.js';
import { MentionText } from '../../components/community/MentionTextarea.jsx';

function Thread({ postId, parentId, depth, user, onChanged, onCancel, onRepliesChanged, hideSpoilerOption, scene, targetPath }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  useEffect(() => { if (targetPath?.[depth]?.page) setPage(targetPath[depth].page); }, [targetPath, depth]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingComment = useRef(null);
  const base = `${scene ? '/api/v1/scene-questions' : '/api/v1/community/posts'}/${postId}/comments`;
  const url = `${base}?page=${page}${parentId ? `&parentId=${parentId}` : ''}`;
  const load = useCallback(async () => {
    const data = await apiRequest(url); setItems(data.items); setMore(data.hasMore); setError('');
  }, [url]);
  useEffect(() => {
    let active = true;
    apiRequest(url).then((data) => { if (active) { setItems(data.items); setMore(data.hasMore); setError(''); } }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [url, user?.id]);
  const submit = async (event) => {
    event.preventDefault(); if (busy || !text.trim()) return;
    setBusy(true); setError('');
    try {
      const body = JSON.stringify({ content: text.trim(), isSpoiler: spoiler, ...(parentId && { parentId }) });
      await apiRequest(base, { method: 'POST', body, headers: commentRequestHeaders(pendingComment, body) });
      clearCommentRequest(pendingComment);
      setText(''); setSpoiler(false); if (page === 1) await load(); else setPage(1); if (onRepliesChanged) await onRepliesChanged(); onChanged?.();
    }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className={depth ? 'movie-replies' : 'post-comment-thread'}>
    {user && <CommentForm onSubmit={submit} text={text} onText={setText} busy={busy} onCancel={onCancel} label={parentId ? 'Viết trả lời...' : 'Viết bình luận...'} />}
    {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
    {items.map((item) => <PostComment key={`${item.id}:${user?.id ?? 'guest'}`} item={item} postId={postId} base={base} depth={depth} user={user} reload={load} onChanged={onChanged} hideSpoilerOption={hideSpoilerOption} scene={scene} targetPath={targetPath} />)}
    {(page > 1 || more) && <CommentPagination page={page} more={more} onPage={setPage} />}
  </div>;
}

function PostComment({ item, postId, base, depth, user, reload, onChanged, hideSpoilerOption, scene, targetPath }) {
  const [expanded, setExpanded] = useState(false);
  const targetId = targetPath?.at(-1)?.id;
  useEffect(() => { if (targetPath?.[depth]?.id === item.id && targetPath[depth + 1]) setExpanded(true); }, [targetPath, depth, item.id]);
  useEffect(() => { if (targetId === item.id) document.getElementById(`post-comment-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [targetId, item.id]);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.content);
  const [editSpoiler, setEditSpoiler] = useState(Boolean(item.is_spoiler));
  const [upvotes, setUpvotes] = useState(item.upvotes ?? 0);
  const [downvotes, setDownvotes] = useState(item.downvotes ?? 0);
  const [vote, setVote] = useState(item.viewer_vote ?? 0);
  const [busy, setBusy] = useState(false);
  const votePending = useRef(false);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const report = async (event) => {
    event.preventDefault();
    try { await apiRequest(`${base}/${item.id}/reports`, { method: 'POST', body: JSON.stringify({ reason, description }) }); setReporting(false); setError('Đã gửi báo cáo'); }
    catch (err) { setError(err.message); }
  };
  const saveVote = async (value) => {
    if (votePending.current) return; votePending.current = true; setBusy(true);
    try { const result = await apiRequest(`${base}/${item.id}/vote`, { method: 'PUT', body: JSON.stringify({ value: vote === value ? 0 : value }) }); setUpvotes(result.upvotes); setDownvotes(result.downvotes); setVote(result.value); }
    catch (err) { setError(err.message); } finally { votePending.current = false; setBusy(false); }
  };
  const edit = async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try { await apiRequest(`${base}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ content: editText.trim(), isSpoiler: editSpoiler }) }); setEditing(false); await reload(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { await apiRequest(`${base}/${item.id}`, { method: 'DELETE' }); await reload(); onChanged?.(); }
    catch (err) { setError(err.message); }
  };
  const active = item.status === 'active';
  const own = active && user?.id === item.author_id;
  return <div id={`post-comment-${item.id}`} className={targetId === item.id ? 'notification-target' : ''}><CommentFrame avatar={item.author?.avatar_url} username={item.author?.username || `Thành viên #${item.author_id}`} vipExpiresAt={item.author?.vip_expires_at} date={item.created_at} profileId={active ? item.author?.id : null}>
    {editing ? <CommentForm onSubmit={edit} text={editText} onText={setEditText} busy={busy} onCancel={() => { setEditing(false); setEditText(item.content); setEditSpoiler(Boolean(item.is_spoiler)); }} label="Chỉnh sửa bình luận" /> : <SpoilerContent spoiler={active && item.is_spoiler}><p className="movie-comment-content"><MentionText text={item.content} /></p></SpoilerContent>}
    <CommentActions user={active ? user : null} upvotes={upvotes} downvotes={downvotes} vote={vote} voteBusy={busy} onVote={saveVote} canReply={depth < 3} onReply={() => setExpanded(true)} menuItems={own ? [{ label: 'Sửa', action: () => setEditing(true) }, { label: 'Xóa', action: remove }] : scene ? [{ label: 'Báo xấu', action: () => setReporting(true) }] : []}>
      {depth < 3 && (item.reply_count > 0 || expanded) && <button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Ẩn trả lời' : `Trả lời (${item.reply_count || 0})`}</button>}
    </CommentActions>
    {reporting && <form className="movie-reply-form" onSubmit={report}><label>Lý do<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="spam">Spam</option><option value="harassment">Quấy rối</option><option value="spoiler">Spoiler</option><option value="other">Khác</option></select></label><label>Mô tả<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="movie-comment-actions"><button type="submit">Gửi báo cáo</button><button type="button" onClick={() => setReporting(false)}>Hủy</button></div></form>}
    {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
    {expanded && <Thread postId={postId} parentId={item.id} depth={depth + 1} user={active ? user : null} onChanged={onChanged} onCancel={() => setExpanded(false)} onRepliesChanged={reload} hideSpoilerOption={hideSpoilerOption} scene={scene} targetPath={targetPath} />}
  </CommentFrame></div>;
}

export default function PostComments({ postId, user, onChanged, hideSpoilerOption = false, scene = false }) {
  const [params] = useSearchParams();
  const targetId = Number(params.get('commentId'));
  const [targetPath, setTargetPath] = useState(null);
  useEffect(() => {
    if (!Number.isSafeInteger(targetId) || targetId <= 0) return;
    let active = true;
    apiRequest(`/api/v1/${scene ? 'scene-questions' : 'community/posts'}/${postId}/comments/${targetId}/context`)
      .then((result) => { if (active) setTargetPath(result.path); }).catch(() => { if (active) setTargetPath(null); });
    return () => { active = false; };
  }, [postId, targetId, scene]);
  return <section><h2 className="text-lg font-semibold">{scene ? 'Trả lời' : 'Bình luận'}</h2><Thread postId={postId} depth={0} user={user} onChanged={onChanged} hideSpoilerOption={hideSpoilerOption} scene={scene} targetPath={targetPath} /></section>;
}
