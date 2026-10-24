import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "—");
const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none";

const GrantVipForm = ({ onGranted }) => {
  const { apiRequest } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [days, setDays] = useState(30);
  const [planId, setPlanId] = useState("");
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    apiRequest("/api/v1/admin/subscriptions")
      .then((data) => setPlans(data.plans || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (event) => {
    event.preventDefault();
    setSearching(true);
    apiRequest(`/api/v1/admin/users?search=${encodeURIComponent(query)}&limit=5`)
      .then((data) => setResults(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setSearching(false));
  };

  const grant = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setError("");
    try {
      const result = await apiRequest(`/api/v1/admin/users/${selected.id}/vip`, {
        method: "POST",
        body: JSON.stringify({ days: Number(days), planId: planId ? Number(planId) : null }),
      });
      setMessage(`Đã kích hoạt VIP cho "${result.username}" đến ${formatDate(result.vipExpiresAt)}. User nhận được thông báo.`);
      setSelected(null);
      setQuery("");
      setResults([]);
      onGranted();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={grant}>
      <h2 className="font-semibold text-slate-900">Kích hoạt VIP thủ công</h2>
      <div className="flex gap-2">
        <input className={inputClass} placeholder="Tìm người dùng theo tên/email..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="button" className="whitespace-nowrap rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white" onClick={search} disabled={searching}>Tìm</button>
      </div>
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selected?.id === item.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:bg-slate-50"}`}
                onClick={() => setSelected(item)}
              >
                <strong>{item.username}</strong> — {item.email}
                {item.vip_expires_at && <span className="text-xs text-amber-600"> · VIP đến {formatDate(item.vip_expires_at)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Số ngày
            <input className={inputClass} type="number" min={1} max={3650} value={days} onChange={(event) => setDays(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Gói (tùy chọn)
            <select className={inputClass} value={planId} onChange={(event) => setPlanId(event.target.value)}>
              <option value="">Không theo gói</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Kích hoạt VIP</button>
          </div>
        </div>
      )}
      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </form>
  );
};

const SubscriptionsAdminPage = () => {
  const { apiRequest } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiRequest("/api/v1/admin/subscriptions")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-slate-500">Đang tải dữ liệu kinh doanh...</p>;
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;

  const maxRevenue = Math.max(...(data.monthly || []).map((row) => row.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">VIP & Doanh thu</h1>
        <p className="text-sm text-slate-500">Quản lý gói đăng ký, giao dịch và kích hoạt VIP thủ công</p>
      </div>

      <GrantVipForm onGranted={load} />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Doanh thu theo tháng</h2>
        {(data.monthly || []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có giao dịch thành công nào.</p>
        ) : (
          <div className="mt-4 flex h-40 items-end gap-2">
            {data.monthly.map((row) => (
              <div key={row.month} className="flex flex-1 flex-col items-center gap-1" title={`${row.month}: ${formatNumber(row.revenue)} ₫ · ${row.transactions} GD`}>
                <div className="w-full rounded-t bg-emerald-500 hover:bg-emerald-600" style={{ height: `${Math.max(4, (row.revenue / maxRevenue) * 100)}%` }} />
                <span className="text-[10px] text-slate-500">{row.month.slice(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Đăng ký VIP gần đây</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Người dùng</th>
                <th className="py-2 pr-4">Gói</th>
                <th className="py-2 pr-4">Hiệu lực</th>
                <th className="py-2 pr-4">Trạng thái</th>
                <th className="py-2">Gia hạn tự động</th>
              </tr>
            </thead>
            <tbody>
              {(data.subscriptions || []).slice(0, 10).map((sub) => (
                <tr key={sub.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-800">{sub.username}</td>
                  <td className="py-2 pr-4 text-slate-600">{sub.plan_name}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatDate(sub.start_date)} → {formatDate(sub.end_date)}</td>
                  <td className="py-2 pr-4">
                    <span className={sub.status === "active" ? "font-medium text-emerald-600" : "text-slate-500"}>{sub.status === "active" ? "Đang hiệu lực" : sub.status}</span>
                  </td>
                  <td className="py-2 text-slate-600">{sub.auto_renew ? "Bật" : "Tắt"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsAdminPage;
