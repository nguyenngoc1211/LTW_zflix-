import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ToxicComment from "../community/ToxicComment.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { apiRequest } from "../../services/api.js";
import UserAvatar from "../UserAvatar.jsx";
import VipIdentity from '../VipIdentity.jsx';
import { vipAvatarClass } from '../vipIdentity.js';
import { commentRequestHeaders, clearCommentRequest } from '../../utils/commentRequest.js';
import MentionTextarea from '../community/MentionTextarea.jsx';

const MAX_LENGTH = 3000;

const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
};

const CommentAvatar = ({ comment }) => <UserAvatar src={comment.avatar_url} className={`w-8 h-8 rounded-full object-cover border border-gray-700 ${vipAvatarClass(comment.vip_expires_at)}`} />;

const CommentSection = ({ productionId, episodeId, composerOnly = false, onSubmitted }) => {
  const [searchParams] = useSearchParams();
  const targetId = Number(searchParams.get('commentId'));
  const { user } = useAuth();
  const pendingComment = useRef(null);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [actionId, setActionId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [revealedCommentIds, setRevealedCommentIds] = useState(() => new Set());
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [revealed, setRevealed] = useState({});

  const loadComments = useCallback(
    async ({ silent = false } = {}) => {
      if (!productionId) return;
      if (!silent) setLoading(true);
      try {
        const data = await apiRequest(`/api/v1/productions/${productionId}/comments`);
        setComments(Array.isArray(data.items) ? data.items : []);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [productionId],
  );

  useEffect(() => {
    if (!composerOnly) loadComments();
  }, [loadComments, composerOnly]);

  useEffect(() => {
    if (!composerOnly && comments.some((item) => item.id === targetId))
      document.getElementById(`movie-comment-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [comments, targetId, composerOnly]);

  useEffect(() => {
    if (openMenuId == null) return undefined;
    const closeMenu = () => setOpenMenuId(null);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenuId]);

  if (!productionId) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError("");
    setWarning("");
    try {
      const body = JSON.stringify({ content, isSpoiler: false, ...(episodeId && { episodeId }) });
      const result = await apiRequest(`/api/v1/productions/${productionId}/comments`, {
        method: "POST",
        body,
        headers: commentRequestHeaders(pendingComment, body),
      });
      clearCommentRequest(pendingComment);
      if (result.warning) setWarning(result.warning);
      setDraft("");
      if (composerOnly) onSubmitted?.();
      else await loadComments({ silent: true });
    } catch (err) {
      setError(err.status === 401 ? "Bạn cần đăng nhập để bình luận." : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId) => {
    const content = editingDraft.trim();
    if (!content || actionId) return;
    setActionId(commentId);
    setError("");
    setWarning("");
    try {
      const result = await apiRequest(`/api/v1/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      if (result.warning) setWarning(result.warning);
      setEditingId(null);
      setEditingDraft("");
      await loadComments({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (comment) => {
    setOpenMenuId(null);
    if (actionId || !window.confirm("Bạn có chắc muốn xóa bình luận này?")) return;
    setActionId(comment.id);
    setError("");
    try {
      await apiRequest(`/api/v1/comments/${comment.id}`, { method: "DELETE" });
      if (editingId === comment.id) {
        setEditingId(null);
        setEditingDraft("");
      }
      await loadComments({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className={composerOnly ? '' : 'mt-8'}>
      <h3 className="text-pink-500 font-bold text-lg mb-4">
        Bình luận
        {!composerOnly && comments.length > 0 && (
          <span className="text-gray-500 text-sm font-normal ml-2">({comments.length})</span>
        )}
      </h3>

      {user ? (
        <form
          onSubmit={handleSubmit}
          className="bg-[#18181b] p-4 rounded-xl border border-gray-800 mb-6"
        >
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            placeholder="Viết bình luận..."
            rows={2}
            maxLength={MAX_LENGTH}
            className="w-full resize-y rounded-lg bg-[#121212] border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-pink-500 transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {draft.length}/{MAX_LENGTH}
            </span>
            <button
              type="submit"
              disabled={!draft.trim() || submitting}
              className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:hover:bg-pink-600 text-white text-xs font-bold transition-colors"
            >
              {submitting ? "Đang gửi..." : "Bình luận"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          {warning && <p className="toxic-comment-notice">{warning}</p>}
        </form>
      ) : (
        <div className="bg-[#18181b] p-4 rounded-xl border border-gray-800 mb-6 text-sm text-gray-400">
          <Link to="/login" className="text-pink-400 hover:text-pink-300 font-semibold">
            Đăng nhập
          </Link>{" "}
          để tham gia bình luận.
        </div>
      )}

      {!composerOnly && (loading ? (
        <p className="text-sm text-gray-500">Đang tải bình luận...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((comment) => {
            const isOwner = Boolean(user && Number(comment.user_id) === Number(user.id));
            const canEdit = isOwner && user?.role !== "admin";
            const canDelete = isOwner || user?.role === "admin";
            const isEditing = editingId === comment.id;
            const isBusy = actionId === comment.id;
            const isToxic = Boolean(Number(comment.is_toxic));
            const toxicRevealed = !isToxic || revealedCommentIds.has(comment.id);
            const spoilerRevealed = !comment.is_spoiler || Boolean(revealed[comment.id]);
            const menuIsOpen = openMenuId === comment.id;
            return (
              <div key={comment.id} id={`movie-comment-${comment.id}`} className={`flex gap-3 ${targetId === comment.id ? 'notification-target' : ''}`}>
                <CommentAvatar comment={comment} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <VipIdentity username={comment.username} vipExpiresAt={comment.vip_expires_at} className="text-sm" />
                    <span className="text-gray-500 text-xs shrink-0">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="rounded-lg border border-gray-700 bg-[#18181b] p-2">
                      <textarea
                        value={editingDraft}
                        onChange={(event) => setEditingDraft(event.target.value)}
                        maxLength={MAX_LENGTH}
                        rows={3}
                        className="w-full resize-y rounded bg-[#121212] border border-gray-700 px-3 py-2 text-sm text-white outline-none focus:border-pink-500"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-300" onClick={() => { setEditingId(null); setEditingDraft(""); }} disabled={isBusy}>Hủy</button>
                        <button type="button" className="rounded bg-pink-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40" onClick={() => handleEdit(comment.id)} disabled={!editingDraft.trim() || isBusy}>{isBusy ? "Đang lưu..." : "Lưu"}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      {spoilerRevealed ? (
                        <ToxicComment
                          content={comment.content}
                          isToxic={isToxic}
                          onReveal={() => setRevealedCommentIds((current) => {
                            const next = new Set(current);
                            next.add(comment.id);
                            return next;
                          })}
                          className="text-gray-300 text-sm bg-[#18181b] py-2 pl-2 pr-10 rounded-lg border border-gray-800 whitespace-pre-wrap break-words"
                        />
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg border border-gray-700 bg-[#18181b] px-3 py-2 text-sm text-gray-300"
                          onClick={() => setRevealed((current) => ({ ...current, [comment.id]: true }))}
                        >
                          Hiện nội dung spoiler
                        </button>
                      )}
                      {toxicRevealed && spoilerRevealed && (canEdit || canDelete) && (
                        <div
                          className="absolute right-1.5 top-1.5 z-20"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            aria-label="Mở tùy chọn bình luận"
                            aria-expanded={menuIsOpen}
                            className={`content-action-trigger grid h-7 w-7 place-items-center rounded-md bg-transparent text-lg leading-none text-gray-400 transition hover:text-white focus:text-white focus:outline-none ${menuIsOpen ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"}`}
                            onClick={() => setOpenMenuId((current) => current === comment.id ? null : comment.id)}
                          >
                            ⋮
                          </button>
                          {menuIsOpen && (
                            <div className="absolute right-0 top-8 min-w-28 overflow-hidden rounded-lg border border-gray-700 bg-[#202024] py-1 shadow-xl">
                              {canEdit && (
                                <button
                                  type="button"
                                  className="content-action-item block w-full bg-transparent px-3 py-2 text-left text-xs text-gray-200 hover:text-white"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setEditingId(comment.id);
                                    setEditingDraft(comment.content);
                                  }}
                                >
                                  Sửa
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="content-action-item content-action-danger block w-full bg-transparent px-3 py-2 text-left text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                                  onClick={() => handleDelete(comment)}
                                  disabled={isBusy}
                                >
                                  {isBusy ? "Đang xóa..." : "Xóa"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {!user && error && <p className="text-xs text-red-400 mt-3">{error}</p>}
    </div>
  );
};

export default CommentSection;
