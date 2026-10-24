import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { watchPartyApi } from "../services/api.js";

export default function CreateParty() {
  const navigate = useNavigate();

  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(true);

  const [title, setTitle] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [password, setPassword] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    watchPartyApi
      .getAvailableEpisodes()
      .then((res) => {
        const items = res?.items || [];
        setEpisodes(items);
        if (items.length > 0) {
          setEpisodeId(String(items[0].id));
          setTitle(`Xem cùng ${items[0].production_title}!`);
        }
      })
      .catch((err) => {
        console.error("Failed to load episodes:", err);
        // Fallback default
        setEpisodes([
          { id: 1, production_title: "The Dark Knight", episode_title: "Full Movie" },
          { id: 2, production_title: "Inception", episode_title: "Full Movie" },
          { id: 21, production_title: "Stranger Things S1", episode_title: "Tập 1: The Vanishing" },
        ]);
        setEpisodeId("1");
        setTitle("Xem The Dark Knight cùng Khoa!");
      })
      .finally(() => setLoadingEpisodes(false));
  }, []);

  const handleEpisodeChange = (e) => {
    const epId = e.target.value;
    setEpisodeId(epId);
    const selected = episodes.find((ep) => String(ep.id) === String(epId));
    if (selected) {
      setTitle(`Xem phim ${selected.production_title} cùng nhau!`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tên phòng xem");
      return;
    }
    if (!episodeId) {
      setErrorMsg("Vui lòng chọn phim/tập phim để chiếu");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg("");
      const res = await watchPartyApi.createParty({
        title: title.trim(),
        episodeId: Number(episodeId),
        password: password.trim() || undefined,
        maxParticipants: Number(maxParticipants) || 15,
      });

      // Tạo phòng thành công -> chuyển thẳng vào phòng
      if (res?.partyId) {
        navigate(`/watch-party/room/${res.partyId}`);
      } else {
        navigate("/watch-party");
      }
    } catch (err) {
      console.error("Create party error:", err);
      setErrorMsg(err.message || "Tạo phòng thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEpisode = episodes.find((ep) => String(ep.id) === String(episodeId));

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 animate-fadeIn">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/watch-party" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
          <span>←</span> Quay lại danh sách phòng
        </Link>
      </div>

      <div className="glass-strong rounded-3xl p-8 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-red-500/20">
            🍿
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Tạo phòng xem phim mới</h1>
            <p className="text-xs text-neutral-400">Bạn sẽ là Host có toàn quyền điều khiển video và quản lý phòng</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm mb-6">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tên phòng */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Tên phòng xem <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Cày phim cuối tuần cùng Khoa và đồng bọn..."
              className="w-full bg-neutral-900 border border-white/10 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Chọn phim / Tập */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Chọn phim & tập phim <span className="text-red-500">*</span>
            </label>
            {loadingEpisodes ? (
              <div className="p-3 text-neutral-400 text-xs bg-neutral-900 rounded-xl">Đang tải danh sách phim...</div>
            ) : (
              <select
                value={episodeId}
                onChange={handleEpisodeChange}
                className="w-full bg-neutral-900 border border-white/10 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-red-500 transition-colors cursor-pointer"
              >
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id} className="bg-neutral-900 py-1 text-white">
                    {ep.production_title} {ep.episode_title ? `— ${ep.episode_title}` : ""}
                  </option>
                ))}
              </select>
            )}

            {/* Preview tập đã chọn */}
            {selectedEpisode && (
              <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                <span className="text-2xl">🎬</span>
                <div className="text-xs">
                  <strong className="text-white block">{selectedEpisode.production_title}</strong>
                  <span className="text-neutral-400">
                    {selectedEpisode.episode_title || "Bản đầy đủ"}
                    {selectedEpisode.duration ? ` • ${Math.round(selectedEpisode.duration / 60)} phút` : ""}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Mật khẩu phòng (tuỳ chọn) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Mật khẩu phòng</span>
                <span className="text-[10px] text-neutral-400 font-normal">Không bắt buộc</span>
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Để trống nếu muốn phòng công khai"
                className="w-full bg-neutral-900 border border-white/10 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-red-500 transition-colors"
              />
            </div>

            {/* Giới hạn người */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Số người tối đa</span>
                <span className="text-red-400 font-bold">{maxParticipants} người</span>
              </label>
              <input
                type="number"
                min="2"
                max="50"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full bg-neutral-900 border border-white/10 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-red-500 transition-colors"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <Link
              to="/watch-party"
              className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-semibold transition-all"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-sm font-bold shadow-xl shadow-red-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {submitting ? "Đang tạo phòng..." : "🚀 Khởi tạo phòng ngay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
