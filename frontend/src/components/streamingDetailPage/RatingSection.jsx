import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { message } from "antd";
import ToxicComment from "../community/ToxicComment.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { apiRequest } from "../../services/api.js";

const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
};

const RatingSection = ({ productionId, onSaved }) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingRating, setEditingRating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [revealedRatingIds, setRevealedRatingIds] = useState(() => new Set());
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const myRating = user
    ? ratings.find((item) => Number(item.user_id) === Number(user.id))
    : null;

  const loadRatings = useCallback(async () => {
    if (!productionId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/v1/productions/${productionId}/ratings`);
      const items = Array.isArray(data.items) ? data.items : [];
      setRatings(items);
      const mine = user
        ? items.find((item) => Number(item.user_id) === Number(user.id))
        : null;
      if (mine) {
        setScore(mine.rating);
        setReview(mine.review_content || "");
      }
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [productionId, user]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

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
  const counts = [1, 2, 3, 4, 5].map((value) => ratings.filter((item) => Number(item.rating) === value).length);
  const average = ratings.length ? ratings.reduce((total, item) => total + Number(item.rating), 0) / ratings.length : 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setWarning("");
    try {
      const result = await apiRequest(`/api/v1/productions/${productionId}/rating`, {
        method: "PUT",
        body: JSON.stringify({ rating: Number(score), review: review.trim() }),
      });
      if (result.warning) setWarning(result.warning);
      setEditingRating(false);
      message.success("Đã lưu đánh giá của bạn.");
      await loadRatings();
      onSaved?.();
    } catch (err) {
      setError(err.status === 401 ? "Bạn cần đăng nhập để đánh giá." : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setOpenMenuId(null);
    if (!myRating || submitting || !window.confirm("Bạn có chắc muốn xóa đánh giá của mình?")) return;
    setSubmitting(true);
    setError("");
    setWarning("");
    try {
      await apiRequest(`/api/v1/productions/${productionId}/rating`, { method: "DELETE" });
      setScore(5);
      setReview("");
      setEditingRating(false);
      message.success("Đã xóa đánh giá của bạn.");
      await loadRatings();
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-pink-500 font-bold text-lg mb-4">
        Đánh giá
        {ratings.length > 0 && (
          <span className="text-gray-500 text-sm font-normal ml-2">({ratings.length})</span>
        )}
      </h3>

      {!loading && ratings.length > 0 && <div className="mb-4 rounded-xl border border-gray-800 bg-[#18181b] p-4 text-sm text-gray-300">
        <p className="mb-2">Điểm cộng đồng: <strong>{average.toFixed(1)}/5</strong> · {ratings.length} đánh giá</p>
        {[5, 4, 3, 2, 1].map((value) => <div key={value} className="flex items-center gap-2"><span className="w-12">{value} sao</span><div className="h-2 flex-1 rounded bg-zinc-700"><div className="h-2 rounded bg-amber-400" style={{ width: `${counts[value - 1] / ratings.length * 100}%` }} /></div><span className="w-8 text-right">{counts[value - 1]}</span></div>)}
      </div>}

      {user && (!myRating || editingRating) ? (
        <form
          onSubmit={handleSubmit}
          className="bg-[#18181b] p-4 rounded-xl border border-gray-800 mb-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-400" htmlFor="rating-score">
              Điểm của bạn
            </label>
            <select
              id="rating-score"
              value={score}
              onChange={(event) => setScore(Number(event.target.value))}
              className="rounded-lg bg-[#121212] border border-gray-700 px-3 py-1.5 text-sm text-white outline-none focus:border-pink-500"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} sao
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={review}
            onChange={(event) => setReview(event.target.value)}
            placeholder="Cảm nhận của bạn (tuỳ chọn)..."
            rows={2}
            maxLength={5000}
            className="mt-3 w-full resize-y rounded-lg bg-[#121212] border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-pink-500 transition-colors"
          />
          <div className="flex items-center justify-between gap-3 mt-2">
            <span className="text-xs text-gray-500">{review.length}/5000</span>
            <div className="flex gap-2">
              {myRating && (
                <button
                  type="button"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40 text-xs font-bold transition-colors"
                  onClick={() => {
                    setScore(myRating.rating);
                    setReview(myRating.review_content || "");
                    setEditingRating(false);
                  }}
                >
                  Hủy
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:hover:bg-pink-600 text-white text-xs font-bold transition-colors"
              >
                {submitting ? "Đang lưu..." : myRating ? "Cập nhật đánh giá" : "Gửi đánh giá"}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          {warning && <p className="toxic-comment-notice">{warning}</p>}
        </form>
      ) : !user ? (
        <div className="bg-[#18181b] p-4 rounded-xl border border-gray-800 mb-6 text-sm text-gray-400">
          <Link to="/login" className="text-pink-400 hover:text-pink-300 font-semibold">
            Đăng nhập
          </Link>{" "}
          để đánh giá phim.
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Đang tải đánh giá...</p>
      ) : ratings.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có đánh giá nào.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ratings.map((item) => (
            <div
              key={item.user_id}
              className="group relative bg-[#18181b] py-3 pl-3 pr-12 rounded-lg border border-gray-800"
            >
              {Number(item.user_id) === Number(user?.id)
                && (!Number(item.is_toxic) || revealedRatingIds.has(item.user_id)) && (
                <div
                  className="absolute right-2 top-2 z-20"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="Mở tùy chọn đánh giá"
                    aria-expanded={openMenuId === item.user_id}
                    className={`content-action-trigger grid h-7 w-7 place-items-center rounded-md bg-transparent text-lg leading-none text-gray-400 transition hover:text-white focus:text-white focus:outline-none ${openMenuId === item.user_id ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"}`}
                    onClick={() => setOpenMenuId((current) => current === item.user_id ? null : item.user_id)}
                  >
                    ⋮
                  </button>
                  {openMenuId === item.user_id && (
                    <div className="absolute right-0 top-8 min-w-28 overflow-hidden rounded-lg border border-gray-700 bg-[#202024] py-1 shadow-xl">
                      <button
                        type="button"
                        className="content-action-item block w-full bg-transparent px-3 py-2 text-left text-xs text-gray-200 hover:text-white"
                        onClick={() => {
                          setOpenMenuId(null);
                          setScore(item.rating);
                          setReview(item.review_content || "");
                          setEditingRating(true);
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="content-action-item content-action-danger block w-full bg-transparent px-3 py-2 text-left text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                        onClick={handleDelete}
                        disabled={submitting}
                      >
                        {submitting ? "Đang xóa..." : "Xóa"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-200 font-bold text-sm">{item.username}</span>
                <span className="text-amber-400 text-sm leading-none">
                  {"★".repeat(item.rating)}
                </span>
                <span className="text-gray-500 text-xs">{formatTime(item.updated_at)}</span>
              </div>
              {item.review_content && (
                <ToxicComment
                  content={item.review_content}
                  isToxic={Boolean(Number(item.is_toxic))}
                  onReveal={() => setRevealedRatingIds((current) => {
                    const next = new Set(current);
                    next.add(item.user_id);
                    return next;
                  })}
                  className="text-gray-300 text-sm mt-1 whitespace-pre-wrap break-words"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RatingSection;
