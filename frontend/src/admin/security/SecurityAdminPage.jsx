import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const PAGE_SIZE = 20;
const formatDateTime = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

const EVENT_LABELS = {
  LOGIN_SUCCESS: "Đăng nhập thành công",
  LOGIN_FAILED: "Đăng nhập thất bại",
  REGISTER_SUCCESS: "Đăng ký thành công",
  REGISTER_FAILED: "Đăng ký thất bại",
  LOGOUT: "Đăng xuất",
  LOGOUT_ALL: "Đăng xuất tất cả phiên",
  LOGOUT_OTHERS: "Đăng xuất phiên khác",
  ACCOUNT_LOCKED: "Tài khoản bị khóa (brute-force)",
  ACCOUNT_DISABLED_LOGIN_ATTEMPT: "Đăng nhập bằng tài khoản bị vô hiệu",
  ACCESS_DENIED: "Truy cập bị từ chối",
  ADMIN_ACCESS_DENIED: "Vào khu vực quản trị bị từ chối",
  MFA_ENABLED: "Bật xác thực 2 bước",
  MFA_DISABLED: "Tắt xác thực 2 bước",
  MFA_LOGIN_SUCCESS: "Đăng nhập qua MFA",
  MFA_VERIFY_FAILED: "Mã MFA sai",
  MFA_SETUP_STARTED: "Bắt đầu cấu hình MFA",
  MFA_RECOVERY_USED: "Dùng mã khôi phục",
  MFA_RECOVERY_REGENERATED: "Tạo lại mã khôi phục",
  PASSWORD_CHANGED: "Đổi mật khẩu",
  PASSWORD_RESET_REQUESTED: "Yêu cầu đặt lại mật khẩu",
  PASSWORD_RESET_SUCCESS: "Đặt lại mật khẩu thành công",
  PASSWORD_RESET_FAILED: "Đặt lại mật khẩu thất bại",
  REFRESH_SUCCESS: "Làm mới phiên",
  REFRESH_FAILED: "Làm mới phiên thất bại",
  SESSION_REVOKED: "Thu hồi phiên",
  SESSION_REVOKE_FAILED: "Thu hồi phiên thất bại",
};

const SecurityAdminPage = () => {
  const { apiRequest } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [event, setEvent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (targetPage = page, eventType = event) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) });
    if (eventType) params.set("event", eventType);
    apiRequest(`/api/v1/admin/security-events?${params}`)
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhật ký bảo mật</h1>
          <p className="text-sm text-slate-500">{total} sự kiện xác thực được ghi nhận (đăng nhập, MFA, khóa tài khoản...)</p>
        </div>
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={event}
          onChange={(e) => {
            setEvent(e.target.value);
            load(1, e.target.value);
          }}
        >
          <option value="">Tất cả sự kiện</option>
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Thời điểm</th>
              <th className="px-4 py-3">Sự kiện</th>
              <th className="px-4 py-3">Người dùng</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Thiết bị</th>
              <th className="px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-slate-500" colSpan="6">Đang tải...</td></tr>}
            {!loading && items.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="6">Chưa có sự kiện nào (hãy đăng nhập/đăng xuất vài lần để sinh log).</td></tr>}
            {!loading && items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{formatDateTime(item.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.event.includes("FAILED") || item.event.includes("DENIED") || item.event.includes("LOCKED") ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {EVENT_LABELS[item.event] || item.event}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{item.username || `#${item.user_id || "—"}`}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.ip || "—"}</td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-500" title={item.user_agent || ""}>{item.user_agent || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{[item.reason, item.factor].filter(Boolean).join(" · ") || "—"}</td>
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

export default SecurityAdminPage;
