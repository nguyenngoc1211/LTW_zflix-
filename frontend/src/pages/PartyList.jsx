import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { watchPartyApi } from "../services/api.js";

export default function PartyList() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directCode, setDirectCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // Modal mật khẩu
  const [selectedParty, setSelectedParty] = useState(null);
  const [inputPassword, setInputPassword] = useState("");
  const [joining, setJoining] = useState(false);

  const navigate = useNavigate();

  const loadParties = async (query = "") => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await watchPartyApi.getParties(query);
      setParties(res.items || []);
    } catch (err) {
      console.error("Failed to load parties:", err);
      setErrorMsg(err.message || "Không thể tải danh sách phòng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParties();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadParties(search);
  };

  const handleJoinDirect = (e) => {
    e.preventDefault();
    const code = directCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/room/${code}`);
  };

  const handleJoinClick = (party) => {
    if (party.has_password) {
      setSelectedParty(party);
      setInputPassword("");
    } else {
      doJoin(party.id, null);
    }
  };

  const doJoin = async (partyId, password) => {
    try {
      setJoining(true);
      await watchPartyApi.joinParty(partyId, password);
      setSelectedParty(null);
      navigate(`/room/${partyId}`);
    } catch (err) {
      alert(err.message || "Không thể tham gia phòng");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 animate-fadeIn">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 mb-10 bg-gradient-to-r from-red-950/40 via-neutral-900 to-purple-950/40 border border-white/10 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-live"></span>
            Real-time Watching Party
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
            Xem phim trực tuyến <br />
            <span className="gradient-text">cùng bạn bè mọi lúc</span>
          </h1>
          <p className="text-neutral-300 text-sm md:text-base mb-6 leading-relaxed">
            Đồng bộ video play/pause tức thời, chat và tương tác với biểu tượng cảm xúc.
            Tạo phòng riêng tư hoặc tham gia các phòng đang chiếu công khai!
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/create"
              className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-600/30 transition-all hover:scale-105"
            >
              🍿 Tạo phòng xem ngay
            </Link>

            {/* Vào nhanh bằng mã phòng */}
            <form onSubmit={handleJoinDirect} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nhập mã phòng (vd: ABC123)"
                value={directCode}
                onChange={(e) => setDirectCode(e.target.value)}
                className="bg-black/60 border border-white/15 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-red-500 w-48 uppercase font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
              >
                Vào phòng
              </button>
            </form>
          </div>
        </div>

        {/* Trang trí background */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-40 top-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Thanh tìm kiếm & lọc */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <span>Phòng đang hoạt động</span>
            <span className="text-xs bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
              {parties.length} phòng
            </span>
          </h2>
          <p className="text-xs text-neutral-400">Chọn một phòng để cùng xem và thảo luận</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              placeholder="Tìm theo tên phòng, tên phim..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 pl-9 outline-none focus:border-red-500"
            />
            <span className="absolute left-3 top-3 text-neutral-500 text-sm">🔍</span>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold transition-all"
          >
            Tìm
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              loadParties("");
            }}
            className="px-3 py-2.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-sm"
            title="Làm mới"
          >
            🔄
          </button>
        </form>
      </div>

      {/* Trạng thái Loading / Lỗi */}
      {loading && (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-400 text-sm">Đang tải danh sách phòng xem phim...</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm mb-6 flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button
            onClick={() => loadParties(search)}
            className="text-xs underline font-semibold hover:text-white"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Danh sách phòng dạng lưới */}
      {!loading && parties.length === 0 && (
        <div className="text-center py-20 rounded-2xl border border-dashed border-white/10 p-8">
          <div className="text-5xl mb-4">🎬</div>
          <h3 className="text-lg font-bold text-white mb-2">Chưa có phòng nào đang mở</h3>
          <p className="text-neutral-400 text-sm max-w-md mx-auto mb-6">
            Hãy là người đầu tiên tạo phòng và mời bạn bè cùng xem những bộ phim bom tấn!
          </p>
          <Link
            to="/create"
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all"
          >
            + Tạo phòng đầu tiên
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parties.map((p) => (
          <div
            key={p.id}
            className="group glass-strong rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/40 transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-xl hover:shadow-red-950/20"
          >
            {/* Header phòng / Poster */}
            <div className="relative h-44 bg-neutral-900 overflow-hidden">
              <img
                src={p.poster_url || "/thumbnails/dark-knight.jpg"}
                alt={p.production_title}
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=60";
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent"></div>

              {/* Status Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white">
                <span className={`w-2 h-2 rounded-full ${p.status === "playing" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`}></span>
                <span>{p.status === "playing" ? "Đang chiếu" : "Chờ bắt đầu"}</span>
              </div>

              {/* Password Icon */}
              {p.has_password ? (
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/30 flex items-center justify-center text-xs text-amber-400" title="Phòng có mật khẩu">
                  🔒
                </div>
              ) : null}

              {/* Mã phòng code badge */}
              <div className="absolute bottom-3 left-3">
                <span className="font-mono text-xs font-black tracking-widest bg-red-600/90 text-white px-2 py-0.5 rounded shadow">
                  #{p.id}
                </span>
              </div>
            </div>

            {/* Chi tiết nội dung */}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-base line-clamp-1 mb-1 group-hover:text-red-400 transition-colors">
                  {p.title}
                </h3>
                <p className="text-xs text-neutral-400 line-clamp-1 mb-3">
                  🎥 {p.production_title} {p.episode_title ? `— ${p.episode_title}` : ""}
                </p>

                {/* Host info */}
                <div className="flex items-center gap-2 py-2 border-t border-b border-white/5 mb-4">
                  <div className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 font-bold text-[10px] flex items-center justify-center border border-white/10">
                    {p.host_name?.[0]?.toUpperCase() || "H"}
                  </div>
                  <span className="text-xs text-neutral-300">
                    Host: <strong className="text-white">{p.host_name}</strong>
                  </span>
                </div>
              </div>

              {/* Footer card */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span>👥</span>
                  <span className="font-semibold text-white">
                    {p.participant_count || 1}
                  </span>
                  <span>/ {p.max_participants || 10} người</span>
                </div>

                <button
                  onClick={() => handleJoinClick(p)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md hover:shadow-red-600/30"
                >
                  Tham gia →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nhập mật khẩu phòng */}
      {selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-neutral-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">🔒 Phòng yêu cầu mật khẩu</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Phòng <strong>{selectedParty.title}</strong> được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu do Host cung cấp.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                doJoin(selectedParty.id, inputPassword);
              }}
            >
              <input
                type="password"
                placeholder="Nhập mật khẩu phòng..."
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                autoFocus
                className="w-full bg-black/60 border border-white/15 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-red-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedParty(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                >
                  {joining ? "Đang vào..." : "Xác nhận vào phòng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
