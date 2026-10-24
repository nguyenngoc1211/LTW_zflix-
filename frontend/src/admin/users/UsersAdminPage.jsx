import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "—");

const PAGE_SIZE = 10;

const UsersAdminPage = () => {
  const { apiRequest, user: currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (targetPage = page, searchTerm = query) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
    if (searchTerm) params.set("search", searchTerm);
    apiRequest(`/api/v1/admin/users?${params}`)
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

  const changeRole = async (target, role) => {
    setMessage("");
    setError("");
    try {
      await apiRequest(`/api/v1/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      setMessage(`Đã đổi vai trò của "${target.username}" thành ${role}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleStatus = async (target) => {
    setMessage("");
    setError("");
    const nextStatus = target.status === "active" ? "disabled" : "active";
    try {
      await apiRequest(`/api/v1/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      setMessage(nextStatus === "disabled" ? `Đã khóa tài khoản "${target.username}".` : `Đã mở khóa tài khoản "${target.username}".`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          <p className="text-sm text-slate-500">{formatNumber(total)} tài khoản</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search);
            load(1, search);
          }}
        >
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tìm theo tên đăng nhập hoặc email..."
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
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Người dùng</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Đăng nhập gần nhất</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan="6">Đang tải...</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan="6">Không tìm thấy người dùng phù hợp.</td>
              </tr>
            )}
            {!loading && items.map((item) => {
              const isSelf = item.id === currentUser?.id;
              return (
                <tr key={item.id} className="border-b border-slate-100 align-middle">
                  <td className="px-4 py-3 text-slate-500">{item.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{item.username}{isSelf && " (bạn)"}</p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      value={item.role}
                      disabled={isSelf}
                      onChange={(event) => changeRole(item, event.target.value)}
                    >
                      <option value="user">Người dùng</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={item.status === "active" ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
                      {item.status === "active" ? "Hoạt động" : "Bị khóa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(item.last_login)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 ${item.status === "active" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                      disabled={isSelf}
                      onClick={() => toggleStatus(item)}
                    >
                      {item.status === "active" ? "Khóa tài khoản" : "Mở khóa"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Trang {page} / {pages}</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => load(page - 1)}
          >
            ← Trước
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40"
            disabled={page >= pages}
            onClick={() => load(page + 1)}
          >
            Sau →
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsersAdminPage;
