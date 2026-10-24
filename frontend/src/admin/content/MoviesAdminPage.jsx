import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));

const PAGE_SIZE = 10;

const MoviesAdminPage = () => {
  const { apiRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchProduction = async (item, body, successText) => {
    setMessage("");
    setError("");
    try {
      await apiRequest(`/api/v1/admin/productions/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setMessage(successText);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý phim</h1>
          <p className="text-sm text-slate-500">{formatNumber(total)} phim · sắp xếp theo lượt xem</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            load(1, search);
          }}
        >
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tìm theo tên phim..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700" type="submit">
            Tìm
          </button>
        </form>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="px-4 py-6 text-slate-500" colSpan="7">Đang tải...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td className="px-4 py-6 text-slate-500" colSpan="7">Không tìm thấy phim phù hợp.</td></tr>
            )}
            {!loading && items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3">
                  <Link to={`/movies/${item.id}`} className="font-medium text-slate-800 hover:text-red-600">{item.title}</Link>
                  <p className="text-xs text-slate-500">{item.type === "movie" ? "Phim lẻ" : "Phim bộ"} · {item.country}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.release_year}</td>
                <td className="px-4 py-3 text-slate-600">{item.episode_count}</td>
                <td className="px-4 py-3 font-medium text-red-600">{formatNumber(item.view_count)}</td>
                <td className="px-4 py-3 text-slate-600">⭐ {Number(item.rating_avg).toFixed(1)} ({item.rating_count})</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    value={item.status}
                    onChange={(event) => patchProduction(item, { status: event.target.value }, `Đã đổi trạng thái "${item.title}".`)}
                  >
                    <option value="ongoing">Đang chiếu</option>
                    <option value="completed">Hoàn tất</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${item.is_premium ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-500 hover:bg-slate-600"}`}
                    onClick={() => patchProduction(item, { is_premium: !item.is_premium }, `Đã ${item.is_premium ? "tắt" : "bật"} VIP cho "${item.title}".`)}
                  >
                    {item.is_premium ? "VIP ✓" : "Thường"}
                  </button>
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
    </div>
  );
};

export default MoviesAdminPage;
