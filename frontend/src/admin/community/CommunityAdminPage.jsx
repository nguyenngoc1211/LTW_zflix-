import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const PAGE_SIZE = 10;
const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none";
const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const formatDateTime = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

const CommentsTab = () => {
  const { apiRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (targetPage = page, searchTerm = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
    if (searchTerm) params.set("search", searchTerm);
    apiRequest(`/api/v1/admin/comments?${params}`)
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

  const remove = async (comment) => {
    if (!window.confirm(`Xóa bình luận của ${comment.username}?`)) return;
    try {
      await apiRequest(`/api/v1/admin/comments/${comment.id}`, { method: "DELETE" });
      setMessage("Đã xóa bình luận.");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          load(1, search);
        }}
      >
        <input className="max-w-sm flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Tìm theo nội dung hoặc tên phim..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white" type="submit">Tìm</button>
      </form>
      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-slate-500">{formatNumber(total)} bình luận</p>
      <div className="space-y-2">
        {loading && <p className="text-sm text-slate-500">Đang tải...</p>}
        {!loading && items.length === 0 && <p className="text-sm text-slate-500">Không có bình luận phù hợp.</p>}
        {!loading && items.map((comment) => (
          <div key={comment.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-0">
              <p className="text-sm">
                <strong className="text-slate-800">{comment.username}</strong>
                <span className="text-slate-500"> trên </span>
                <span className="font-medium text-red-700">{comment.production_title}</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">{comment.content}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(comment.created_at)}</p>
            </div>
            <button type="button" className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700" onClick={() => remove(comment)}>Xóa</button>
          </div>
        ))}
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

const RatingsTab = () => {
  const { apiRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (targetPage = page) => {
    setLoading(true);
    apiRequest(`/api/v1/admin/ratings?page=${targetPage}&limit=${PAGE_SIZE}`)
      .then((data) => {
        setItems(data.items);
        setPages(data.pages);
        setPage(data.page);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (rating) => {
    if (!window.confirm(`Xóa đánh giá ${rating.rating} sao của ${rating.username} cho "${rating.production_title}"?`)) return;
    try {
      await apiRequest(`/api/v1/admin/ratings/${rating.user_id}/${rating.production_id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Người dùng</th>
              <th className="px-4 py-3">Phim</th>
              <th className="px-4 py-3">Điểm</th>
              <th className="px-4 py-3">Nhận xét</th>
              <th className="px-4 py-3">Khi</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-slate-500" colSpan="6">Đang tải...</td></tr>}
            {!loading && items.map((rating) => (
              <tr key={`${rating.user_id}-${rating.production_id}`} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{rating.username}</td>
                <td className="px-4 py-3 text-slate-600">{rating.production_title}</td>
                <td className="px-4 py-3">{"⭐".repeat(rating.rating)}</td>
                <td className="max-w-xs px-4 py-3 text-slate-600">
                  {rating.review_title && <strong className="block text-slate-800">{rating.review_title}</strong>}
                  {rating.review_content || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(rating.created_at)}</td>
                <td className="px-4 py-3">
                  <button type="button" className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => remove(rating)}>Xóa</button>
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

const BroadcastTab = () => {
  const { apiRequest } = useAuth();
  const [form, setForm] = useState({ title: "", message: "", redirectUrl: "" });
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const response = await apiRequest("/api/v1/admin/notifications/broadcast", { method: "POST", body: JSON.stringify(form) });
      setResult(`Đã gửi thông báo tới ${response.sent} người dùng đang hoạt động.`);
      setForm({ title: "", message: "", redirectUrl: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="max-w-xl space-y-4" onSubmit={submit}>
      <p className="text-sm text-slate-500">Gửi thông báo hệ thống tới <strong>tất cả người dùng đang hoạt động</strong> — họ sẽ thấy ở trang Thông báo.</p>
      <label className="block text-sm font-medium text-slate-700">
        Tiêu đề *
        <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required maxLength={255} placeholder="Ví dụ: Có phim mới!" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Nội dung *
        <textarea className={`${inputClass} min-h-24`} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} required maxLength={1000} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Link khi bấm vào (tùy chọn)
        <input className={inputClass} value={form.redirectUrl} onChange={(e) => setForm((f) => ({ ...f, redirectUrl: e.target.value }))} placeholder="/watch-party hoặc /movies/3" />
      </label>
      {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700" disabled={sending}>
        {sending ? "Đang gửi..." : "📤 Gửi thông báo"}
      </button>
    </form>
  );
};

const CommunityAdminPage = () => {
  const [tab, setTab] = useState("comments");
  const tabs = [
    { key: "comments", label: "Bình luận" },
    { key: "ratings", label: "Đánh giá" },
    { key: "broadcast", label: "Gửi thông báo" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cộng đồng</h1>
        <p className="text-sm text-slate-500">Duyệt bình luận, đánh giá và gửi thông báo hệ thống</p>
      </div>
      <div className="flex gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.key ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "comments" && <CommentsTab />}
      {tab === "ratings" && <RatingsTab />}
      {tab === "broadcast" && <BroadcastTab />}
    </div>
  );
};

export default CommunityAdminPage;
