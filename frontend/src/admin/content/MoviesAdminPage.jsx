import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const PAGE_SIZE = 10;

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none";

// ---------------------------------------------------------------------------
// Modal thêm/sửa phim
// ---------------------------------------------------------------------------
const ProductionModal = ({ production, genres, onClose, onSave, saving }) => {
  const { apiRequest } = useAuth();
  const [form, setForm] = useState(() => ({
    title: production?.title || "",
    type: production?.type || "movie",
    description: "",
    releaseYear: production?.release_year || new Date().getFullYear(),
    country: production?.country || "",
    language: "Vietnamese",
    posterUrl: production?.poster_url || "",
    bannerUrl: production?.banner_url || "",
    isPremium: Boolean(production?.is_premium),
    status: production?.status || "ongoing",
    genres: [],
  }));
  const [detailLoading, setDetailLoading] = useState(Boolean(production));

  // Lấy chi tiết đầy đủ (mô tả, thể loại...) khi sửa
  useEffect(() => {
    if (!production) return;
    apiRequest(`/api/v1/admin/productions/${production.id}`)
      .then((detail) => {
        setForm((current) => ({
          ...current,
          title: detail.title,
          type: detail.type,
          description: detail.description || "",
          releaseYear: detail.release_year || current.releaseYear,
          country: detail.country || "",
          language: detail.language || "Vietnamese",
          posterUrl: detail.poster_url || "",
          bannerUrl: detail.banner_url || "",
          isPremium: Boolean(detail.is_premium),
          status: detail.status || "ongoing",
          genres: detail.genre_ids || [],
        }));
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [production?.id]);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const toggleGenre = (genreId) =>
    setForm((current) => ({
      ...current,
      genres: current.genres.includes(genreId)
        ? current.genres.filter((id) => id !== genreId)
        : [...current.genres, genreId],
    }));

  const submit = (event) => {
    event.preventDefault();
    onSave({
      title: form.title,
      type: form.type,
      description: form.description,
      releaseYear: Number(form.releaseYear) || null,
      country: form.country,
      language: form.language,
      posterUrl: form.posterUrl,
      bannerUrl: form.bannerUrl,
      isPremium: form.isPremium,
      status: form.status,
      genres: form.genres,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <form
        className="mt-8 w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 className="text-lg font-bold text-slate-900">{production ? `Sửa phim: ${production.title}` : "Thêm phim mới"}</h2>
        {detailLoading && <p className="text-sm text-slate-500">Đang tải thông tin phim...</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Tên phim *
            <input className={inputClass} value={form.title} onChange={set("title")} required maxLength={255} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Loại
            <select className={inputClass} value={form.type} onChange={set("type")}>
              <option value="movie">Phim lẻ</option>
              <option value="series">Phim bộ</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Năm phát hành
            <input className={inputClass} type="number" value={form.releaseYear} onChange={set("releaseYear")} min={1900} max={2100} />
          </label>
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Mô tả
            <textarea className={`${inputClass} min-h-20`} value={form.description} onChange={set("description")} maxLength={2000} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Quốc gia
            <input className={inputClass} value={form.country} onChange={set("country")} placeholder="USA, Vietnam..." />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Ngôn ngữ
            <input className={inputClass} value={form.language} onChange={set("language")} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Poster URL
            <input className={inputClass} value={form.posterUrl} onChange={set("posterUrl")} placeholder="/posters/... hoặc https://..." />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Banner URL
            <input className={inputClass} value={form.bannerUrl} onChange={set("bannerUrl")} placeholder="/banners/..." />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Trạng thái
            <select className={inputClass} value={form.status} onChange={set("status")}>
              <option value="ongoing">Đang chiếu</option>
              <option value="completed">Hoàn tất</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.isPremium} onChange={(event) => setForm((c) => ({ ...c, isPremium: event.target.checked }))} />
            Phim VIP
          </label>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-slate-700">Thể loại</p>
            <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => toggleGenre(genre.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${form.genres.includes(genre.id) ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={onClose}>Hủy</button>
          <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Modal quản lý tập của một phim
// ---------------------------------------------------------------------------
const EpisodesModal = ({ production, onClose, onChanged }) => {
  const { apiRequest } = useAuth();
  const [episodes, setEpisodes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ episodeNumber: "", title: "", videoUrl: "https://vjs.zencdn.net/v/oceans.mp4", duration: "" });
  const [message, setMessage] = useState("");

  const load = () => {
    apiRequest(`/api/v1/admin/productions/${production.id}/episodes`)
      .then((data) => setEpisodes(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addEpisode = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await apiRequest(`/api/v1/admin/productions/${production.id}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          episodeNumber: Number(form.episodeNumber),
          title: form.title,
          videoUrl: form.videoUrl,
          duration: Number(form.duration) || 0,
        }),
      });
      setMessage(`Đã thêm tập ${form.episodeNumber} — người quan tâm phim sẽ nhận được thông báo.`);
      setForm({ episodeNumber: "", title: "", videoUrl: "https://vjs.zencdn.net/v/oceans.mp4", duration: "" });
      setAdding(false);
      load();
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteEpisode = async (episode) => {
    setError("");
    try {
      await apiRequest(`/api/v1/admin/episodes/${episode.id}`, { method: "DELETE" });
      setMessage(`Đã xóa tập ${episode.episode_number}.`);
      load();
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const updateVideoUrl = async (episode) => {
    const url = window.prompt("Video URL mới cho tập " + episode.episode_number, episode.video_url || "");
    if (url === null) return;
    setError("");
    try {
      await apiRequest(`/api/v1/admin/episodes/${episode.id}`, { method: "PATCH", body: JSON.stringify({ videoUrl: url }) });
      setMessage("Đã cập nhật video URL.");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="mt-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Quản lý tập — {production.title}</h2>
          <button type="button" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setAdding((v) => !v)}>
            {adding ? "Đóng form" : "+ Thêm tập"}
          </button>
        </div>
        {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {adding && (
          <form className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2" onSubmit={addEpisode}>
            <input className={inputClass} type="number" min={1} placeholder="Số tập *" value={form.episodeNumber} onChange={(e) => setForm((f) => ({ ...f, episodeNumber: e.target.value }))} required />
            <input className={inputClass} placeholder="Tiêu đề tập *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            <input className={inputClass} placeholder="Video URL" value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} />
            <input className={inputClass} type="number" min={0} placeholder="Thời lượng (giây)" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
            <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Thêm tập</button>
          </form>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Đang tải...</p>
        ) : (
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {episodes.length === 0 && <li className="text-sm text-slate-500">Chưa có tập nào.</li>}
            {episodes.map((episode) => (
              <li key={episode.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">Tập {episode.episode_number}: {episode.title}</p>
                  <p className="truncate text-xs text-slate-500">{Math.round(episode.duration / 60)} phút · {episode.video_url || "(chưa có video)"}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium" onClick={() => updateVideoUrl(episode)}>Sửa URL</button>
                  <button type="button" className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => deleteEpisode(episode)}>Xóa</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 text-right">
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Trang chính
// ---------------------------------------------------------------------------
const MoviesAdminPage = () => {
  const { apiRequest, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {type:'edit'|'create', production?} | {type:'episodes', production}
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const load = (targetPage = page, searchTerm = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
    if (searchTerm) params.set("search", searchTerm);
    apiRequest(`/api/v1/admin/productions?${params}`)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setPages(data.pages);
        setPage(data.page);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, "");
    apiRequest("/api/v1/filters").then(setGenres).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProduction = async (payload) => {
    setSaving(true);
    setError("");
    try {
      if (modal.production) {
        await apiRequest(`/api/v1/admin/productions/${modal.production.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setMessage(`Đã cập nhật "${payload.title}".`);
      } else {
        await apiRequest("/api/v1/admin/productions", { method: "POST", body: JSON.stringify(payload) });
        setMessage(`Đã thêm phim "${payload.title}".`);
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduction = async (item) => {
    if (!window.confirm(`Xóa phim "${item.title}"? Hành động không thể hoàn tác.`)) return;
    setError("");
    try {
      await apiRequest(`/api/v1/admin/productions/${item.id}`, { method: "DELETE" });
      setMessage(`Đã xóa "${item.title}".`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const togglePremium = async (item) => {
    setError("");
    try {
      await apiRequest(`/api/v1/admin/productions/${item.id}`, { method: "PATCH", body: JSON.stringify({ is_premium: !item.is_premium }) });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const reindex = async () => {
    setReindexing(true);
    setError("");
    try {
      const result = await apiRequest("/api/v1/admin/search/reindex", { method: "POST" });
      setMessage(`Đã đồng bộ lại index tìm kiếm (${result.reindexed} phim).`);
    } catch (e) {
      setError(e.message);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý phim</h1>
          <p className="text-sm text-slate-500">{formatNumber(total)} phim · thêm/sửa/xóa phim và tập</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={reindex} disabled={reindexing}>
            {reindexing ? "Đang reindex..." : "🔄 Reindex tìm kiếm"}
          </button>
          <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" onClick={() => setModal({ type: "create" })}>
            + Thêm phim
          </button>
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          load(1, search);
        }}
      >
        <input className="max-w-sm flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Tìm theo tên phim..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" type="submit">Tìm</button>
      </form>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Phim</th>
              <th className="px-4 py-3">Năm</th>
              <th className="px-4 py-3">Tập</th>
              <th className="px-4 py-3">Lượt xem</th>
              <th className="px-4 py-3">Điểm</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">VIP</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-slate-500" colSpan="8">Đang tải...</td></tr>}
            {!loading && items.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="8">Không tìm thấy phim phù hợp.</td></tr>}
            {!loading && items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <Link to={`/movies/${item.id}`} className="font-medium text-slate-800 hover:text-red-600">{item.title}</Link>
                  <p className="text-xs text-slate-500">{item.type === "movie" ? "Phim lẻ" : "Phim bộ"} · {item.country || "—"}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.release_year || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{item.episode_count}</td>
                <td className="px-4 py-3 font-medium text-red-600">{formatNumber(item.view_count)}</td>
                <td className="px-4 py-3 text-slate-600">⭐ {Number(item.rating_avg).toFixed(1)} ({item.rating_count})</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    value={item.status}
                    onChange={(event) => apiRequest(`/api/v1/admin/productions/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) }).then(load).catch((e) => setError(e.message))}
                  >
                    <option value="ongoing">Đang chiếu</option>
                    <option value="completed">Hoàn tất</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${item.is_premium ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-500 hover:bg-slate-600"}`}
                    onClick={() => togglePremium(item)}
                  >
                    {item.is_premium ? "VIP ✓" : "Thường"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50" onClick={() => setModal({ type: "edit", production: item })}>Sửa</button>
                    <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50" onClick={() => setModal({ type: "episodes", production: item })}>Tập</button>
                    {isAdmin && (
                      <button type="button" className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700" onClick={() => deleteProduction(item)}>Xóa</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Trang {page} / {pages}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40" disabled={page <= 1} onClick={() => load(page - 1)}>← Trước</button>
          <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40" disabled={page >= pages} onClick={() => load(page + 1)}>Sau →</button>
        </div>
      </div>

      {modal?.type === "create" && <ProductionModal genres={genres?.genres || []} onClose={() => setModal(null)} onSave={saveProduction} saving={saving} />}
      {modal?.type === "edit" && <ProductionModal production={modal.production} genres={genres?.genres || []} onClose={() => setModal(null)} onSave={saveProduction} saving={saving} />}
      {modal?.type === "episodes" && <EpisodesModal production={modal.production} onClose={() => setModal(null)} onChanged={load} />}
    </div>
  );
};

export default MoviesAdminPage;
