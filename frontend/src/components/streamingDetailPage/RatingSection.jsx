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
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const loadRatings = useCallback(async () => {
    if (!productionId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/v1/productions/${productionId}/ratings`);
      const items = Array.isArray(data.items) ? data.items : [];
      setRatings(items);
      const mine = user ? items.find((item) => item.user_id === user.id) : null;
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

  if (!productionId) return null;

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
      message.success("Đã lưu đánh giá của bạn.");
      await loadRatings();
      onSaved?.();
    } catch (err) {
      setError(err.status === 401 ? "Bạn cần đăng nhập để đánh giá." : err.message);
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

      {user ? (
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
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">{review.length}/5000</span>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:hover:bg-pink-600 text-white text-xs font-bold transition-colors"
            >
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
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
          để đánh giá phim.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Đang tải đánh giá...</p>
      ) : ratings.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có đánh giá nào.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {ratings.map((item) => (
            <div
              key={item.user_id}
              className="bg-[#18181b] p-3 rounded-lg border border-gray-800"
            >
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
