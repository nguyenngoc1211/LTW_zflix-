import { useCallback, useEffect, useRef, useState } from 'react';
import { CommentActions, CommentForm, CommentFrame, CommentMedia, CommentPagination, SpoilerContent } from '../community/UnifiedComment.jsx';
import { DeleteContentDialog, ReportContentDialog } from '../community/CommunityActionDialogs.jsx';
import ToxicComment from '../community/ToxicComment.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { apiRequest } from '../../services/api.js';
import { commentPayload, commentRequestHeaders, clearCommentRequest } from '../../utils/commentRequest.js';
import { MentionText } from '../community/MentionTextarea.jsx';

export default function MovieCommentItem({ comment, productionId, episodeId, depth = 0, onChanged, onRepliesChanged, targetPath = [], targetPages = {} }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [replyImage, setReplyImage] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content === '[Ảnh]' ? '' : comment.content);
  const [editImage, setEditImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [upvotes, setUpvotes] = useState(comment.upvotes ?? 0);
  const [downvotes, setDownvotes] = useState(comment.downvotes ?? 0);
  const [vote, setVote] = useState(comment.viewer_vote ?? 0);
  const votePending = useRef(false);
  const pendingComment = useRef(null);
  const own = user && Number(comment.user_id) === Number(user.id);
  const staff = user?.role === 'admin';
  const endpoint = `/api/v1/productions/${productionId}/comments`;
  const branchUrl = `${endpoint}?parentId=${comment.id}&page=${page}&limit=20${episodeId ? `&episodeId=${episodeId}` : ''}`;
  useEffect(() => { if (!targetPath.includes(comment.id)) return; const timer = setTimeout(() => { setExpanded(true); setPage(targetPages[comment.id] || 1); }, 0); return () => clearTimeout(timer); }, [comment.id, targetPath, targetPages]);
  const load = useCallback(async () => { const data = await apiRequest(branchUrl); setItems(data.items || []); setMore(Boolean(data.hasMore)); setError(''); }, [branchUrl]);
  useEffect(() => { if (!expanded) return undefined; let active = true; apiRequest(branchUrl).then((data) => { if (active) { setItems(data.items || []); setMore(Boolean(data.hasMore)); } }).catch((cause) => { if (active) setError(cause.message); }); return () => { active = false; }; }, [expanded, branchUrl]);
  const saveVote = async (value) => {
    if (votePending.current) return;
    votePending.current = true;
    try { const result = await apiRequest(`/api/v1/comments/${comment.id}/vote`, { method: 'PUT', body: JSON.stringify({ value: vote === value ? 0 : value }) }); setUpvotes(result.upvotes); setDownvotes(result.downvotes); setVote(result.value); }
    catch (cause) { setError(cause.message); }
    finally { votePending.current = false; }
  };
  const submitReply = async (event) => {
    event.preventDefault(); if (busy || (!text.trim() && !replyImage)) return;
    setBusy(true); setError('');
    try {
      const { body, signature } = commentPayload({ content: text, imageFile: replyImage, parentId: comment.id, isSpoiler: false, ...(episodeId && { episodeId }) });
      await apiRequest(endpoint, { method: 'POST', body, headers: commentRequestHeaders(pendingComment, signature) });
      clearCommentRequest(pendingComment);
      setText(''); setReplyImage(null); setReplying(false); setExpanded(true); setPage(1);
      if (page === 1) await load();
      await onRepliesChanged?.(); onChanged?.();
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const saveEdit = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { const { body } = commentPayload({ content, imageFile: editImage, isSpoiler: Boolean(comment.is_spoiler), ...(removeImage && { removeImage: true }) }); await apiRequest(`/api/v1/comments/${comment.id}`, { method: 'PATCH', body }); setEditing(false); setEditImage(null); setRemoveImage(false); await onRepliesChanged?.(); onChanged?.(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const remove = async () => { await apiRequest(`/api/v1/comments/${comment.id}`, { method: 'DELETE' }); await onRepliesChanged?.(); onChanged?.(); };
  const report = async ({ reason, description }) => { await apiRequest(`/api/v1/comments/${comment.id}/reports`, { method: 'POST', body: JSON.stringify({ reason, description }) }); setNotice('Đã gửi báo cáo cho quản trị viên.'); };
  const menuItems = !user ? [] : own ? [{ label: 'Sửa', action: () => { setContent(comment.content === '[Ảnh]' ? '' : comment.content); setEditImage(null); setRemoveImage(false); setEditing(true); } }, { label: 'Xóa', action: () => setConfirmDelete(true) }] : [...(staff ? [{ label: 'Xóa nội dung', action: () => setConfirmDelete(true) }] : []), { label: 'Báo cáo', action: () => setReporting(true) }];
  return <div id={`movie-comment-${comment.id}`}><CommentFrame avatar={comment.avatar_url} username={comment.username || `Thành viên #${comment.user_id}`} vipExpiresAt={comment.vip_expires_at} date={comment.created_at} profileId={comment.user_id}>
    {editing ? <CommentForm onSubmit={saveEdit} text={content} onText={setContent} imageFile={editImage} onImageFile={setEditImage} existingImageUrl={removeImage ? null : comment.image_urls?.[0]} onRemoveExisting={() => setRemoveImage(true)} busy={busy} onCancel={() => { setEditing(false); setContent(comment.content === '[Ảnh]' ? '' : comment.content); setEditImage(null); setRemoveImage(false); }} label="Chỉnh sửa bình luận" /> : <SpoilerContent spoiler={comment.is_spoiler}>{comment.content !== '[Ảnh]' && <ToxicComment content={comment.content} isToxic={Boolean(Number(comment.is_toxic))} className="movie-comment-content"><p><MentionText text={comment.content} /></p></ToxicComment>}<CommentMedia urls={comment.image_urls} /></SpoilerContent>}
    <CommentActions user={user} upvotes={upvotes} downvotes={downvotes} vote={vote} voteBusy={false} onVote={saveVote} canReply={depth < 3} onReply={() => setReplying((value) => !value)} menuItems={menuItems}>{(comment.reply_count > 0 || expanded) && <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Ẩn trả lời' : `Trả lời (${comment.reply_count || 0})`}</button>}</CommentActions>
    {replying && <CommentForm onSubmit={submitReply} text={text} onText={setText} imageFile={replyImage} onImageFile={setReplyImage} busy={busy} onCancel={() => setReplying(false)} label={`Trả lời ${comment.username || 'thành viên'}`} />}
    {reporting && <ReportContentDialog kind="bình luận" onSubmit={report} onClose={() => setReporting(false)} />}
    {confirmDelete && <DeleteContentDialog kind="bình luận" onConfirm={remove} onClose={() => setConfirmDelete(false)} />}
    {notice && <p role="status" className="text-emerald-300 text-xs">{notice}</p>}{error && <p role="alert" className="text-red-300 text-xs">{error}</p>}
    {expanded && <div className="movie-replies">{items.map((item) => <MovieCommentItem key={item.id} comment={item} productionId={productionId} episodeId={episodeId} depth={depth + 1} onChanged={onChanged} onRepliesChanged={load} targetPath={targetPath} targetPages={targetPages} />)}{(page > 1 || more) && <CommentPagination page={page} more={more} onPage={setPage} />}</div>}
  </CommentFrame></div>;
}
