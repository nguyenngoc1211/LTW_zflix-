import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none";

const ShoppingAdminPage = () => {
  const { apiRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [productions, setProductions] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    productionId: "",
    episodeId: "",
    timestampStart: "0",
    timestampEnd: "60",
    productName: "",
    category: "",
    imageUrl: "",
    shopeeKeyword: "",
    note: "",
  });

  const load = (targetPage = page) => {
    setLoading(true);
    apiRequest(`/api/v1/shopping/admin/products?page=${targetPage}&limit=10`)
      .then((data) => {
        setItems(data.items);
        setPage(data.page);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    apiRequest("/api/v1/admin/productions?limit=50").then((data) => setProductions(data.items)).catch(() => {});
    apiRequest("/api/v1/shopping/admin/snapshots?limit=5").then((data) => setSnapshots(data.items)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiRequest("/api/v1/shopping/admin/products", {
        method: "POST",
        body: JSON.stringify({
          productionId: Number(form.productionId),
          episodeId: form.episodeId ? Number(form.episodeId) : null,
          timestampStart: Number(form.timestampStart),
          timestampEnd: Number(form.timestampEnd),
          productName: form.productName,
          category: form.category,
          imageUrl: form.imageUrl,
          shopeeKeyword: form.shopeeKeyword,
          note: form.note,
        }),
      });
      setMessage(`Đã gắn sản phẩm "${form.productName}" vào phim.`);
      setForm((current) => ({ ...current, productName: "", category: "", imageUrl: "", shopeeKeyword: "", note: "" }));
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Bỏ gắn "${item.productName}"?`)) return;
    try {
      await apiRequest(`/api/v1/shopping/admin/products/${item.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mua sắm trong phim (Shoppable)</h1>
        <p className="text-sm text-slate-500">
          Gắn sản phẩm vào mốc thời gian — người xem chụp khung hình sẽ thấy và mua qua Shopee.
          Link affiliate cấu hình bằng <code>SHOPEE_AFFILIATE_PREFIX</code> trong backend/.env.
        </p>
      </div>

      <form className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
        <label className="text-sm font-medium text-slate-700">
          Phim *
          <select className={inputClass} value={form.productionId} onChange={(e) => setForm((f) => ({ ...f, productionId: e.target.value }))} required>
            <option value="">— Chọn phim —</option>
            {productions.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          ID tập (để trống = cả phim)
          <input className={inputClass} type="number" value={form.episodeId} onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))} placeholder="vd: 1" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Bắt đầu (giây) *
          <input className={inputClass} type="number" min="0" value={form.timestampStart} onChange={(e) => setForm((f) => ({ ...f, timestampStart: e.target.value }))} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Kết thúc (giây) *
          <input className={inputClass} type="number" min="0" value={form.timestampEnd} onChange={(e) => setForm((f) => ({ ...f, timestampEnd: e.target.value }))} required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Tên sản phẩm *
          <input className={inputClass} value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} placeholder="Áo khoác da nam..." required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Danh mục
          <input className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Thời trang / Phụ kiện..." />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Từ khoá Shopee * <span className="font-normal text-slate-400">(dùng tạo link tìm kiếm)</span>
          <input className={inputClass} value={form.shopeeKeyword} onChange={(e) => setForm((f) => ({ ...f, shopeeKeyword: e.target.value }))} placeholder="ao khoac da nam den" required />
        </label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-4">
          Ảnh sản phẩm (URL, tùy chọn)
          <input className={inputClass} value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://... hoặc /products/..." />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">+ Gắn sản phẩm</button>
        </div>
      </form>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Phim</th>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3">Mốc thời gian</th>
              <th className="px-4 py-3">Từ khoá Shopee</th>
              <th className="px-4 py-3">Click</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-slate-500" colSpan="6">Đang tải...</td></tr>}
            {!loading && items.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="6">Chưa gắn sản phẩm nào.</td></tr>}
            {!loading && items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-600">{item.productionTitle}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{item.productName}</p>
                  {item.category && <p className="text-xs text-slate-500">{item.category}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.timestampStart}s – {item.timestampEnd}s{item.episodeId ? ` · tập ${item.episodeId}` : ""}</td>
                <td className="px-4 py-3">
                  <a className="text-red-600 hover:underline" href={item.shopeeUrl} target="_blank" rel="noopener noreferrer">{item.shopeeKeyword} ↗</a>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{formatNumber(item.clickCount)}</td>
                <td className="px-4 py-3">
                  <button type="button" className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => remove(item)}>Bỏ gắn</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {snapshots.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Khung hình người dùng chụp gần đây</h2>
          <p className="text-xs text-slate-500">Dữ liệu để đối chiếu / huấn luyện nhận diện ảnh sau này</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {snapshots.map((snap) => (
              <li key={snap.id}>
                {snap.username || "Ẩn danh"} · {snap.episodeTitle || `tập ${snap.episodeId}`} · giây {snap.position}
                {snap.matchedProduct ? ` → khớp "${snap.matchedProduct}"` : " → chưa khớp sản phẩm"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ShoppingAdminPage;
