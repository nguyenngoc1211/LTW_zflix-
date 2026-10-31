import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ToxicComment from "../community/ToxicComment.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { apiRequest } from "../../services/api.js";

const MAX_LENGTH = 3000;

const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
};

const CommentAvatar = ({ comment }) => {
  const [failed, setFailed] = useState(false);
  if (comment.avatar_url && !failed) {
    return (
      <img
        src={comment.avatar_url}
        alt=""
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-full object-cover border border-gray-700"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 text-gray-200 text-xs font-bold flex items-center justify-center">
      {(comment.username || "U").charAt(0).toUpperCase()}
    </div>
  );
};

const CommentSection = ({ productionId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

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
    loadComments();
  }, [loadComments]);

  if (!productionId) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError("");
    setWarning("");
    try {
      const result = await apiRequest(`/api/v1/productions/${productionId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      if (result.warning) setWarning(result.warning);
      setDraft("");
      await loadComments({ silent: true });
    } catch (err) {
      setError(err.status === 401 ? "Bạn cần đăng nhập để bình luận." : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-pink-500 font-bold text-lg mb-4">
        Bình luận
        {comments.length > 0 && (
          <span className="text-gray-500 text-sm font-normal ml-2">({comments.length})</span>
        )}
      </h3>

      {user ? (
        <form
          onSubmit={handleSubmit}
          className="bg-[#18181b] p-4 rounded-xl border border-gray-800 mb-6"
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
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

      {loading ? (
        <p className="text-sm text-gray-500">Đang tải bình luận...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <CommentAvatar comment={comment} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-200 font-bold text-sm truncate">
                    {comment.username}
                  </span>
                  <span className="text-gray-500 text-xs shrink-0">
                    {formatTime(comment.created_at)}
                  </span>
                </div>
                <ToxicComment
                  content={comment.content}
                  isToxic={Boolean(Number(comment.is_toxic))}
                  className="text-gray-300 text-sm bg-[#18181b] p-2 rounded-lg border border-gray-800 whitespace-pre-wrap break-words"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!user && error && <p className="text-xs text-red-400 mt-3">{error}</p>}
    </div>
  );
};

export default CommentSection;
