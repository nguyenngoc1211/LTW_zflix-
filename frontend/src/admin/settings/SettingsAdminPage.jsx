import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none";

const SettingsAdminPage = () => {
  const { apiRequest } = useAuth();
  const [productions, setProductions] = useState([]);
  const [featured, setFeatured] = useState("");
  const [featuredInfo, setFeaturedInfo] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest("/api/v1/admin/productions?limit=50")
      .then((data) => setProductions(data.items))
      .catch(() => {});
    apiRequest("/api/v1/admin/settings/featured")
      .then((data) => {
        setFeatured(data.featuredProductionId ? String(data.featuredProductionId) : "");
        setFeaturedInfo(data.production);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveFeatured = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest("/api/v1/admin/settings/featured", {
        method: "PUT",
        body: JSON.stringify({ productionId: featured === "" ? null : Number(featured) }),
      });
      setMessage(result.featuredProductionId ? "Đã lưu phim nổi bật — trang chủ sẽ hiển thị banner này." : "Đã bỏ đặt phim nổi bật.");
      setFeaturedInfo(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadCsv = async (kind) => {
    try {
      const response = await fetch(`/api/v1/admin/export/${kind}.csv`, {
        headers: { Authorization: `Bearer ${(await import("../../services/api.js")).getAccessToken()}` },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Tải thất bại");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zflix-${kind}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cài đặt hệ thống</h1>
        <p className="text-sm text-slate-500">Banner trang chủ, xuất dữ liệu và bảo trì tìm kiếm</p>
      </div>

      <form className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={saveFeatured}>
        <h2 className="font-semibold text-slate-900">Phim nổi bật trên trang chủ</h2>
        <p className="text-sm text-slate-500">Chọn một phim làm banner lớn ở đầu trang chủ (để trống để dùng banner mặc định).</p>
        <select className={inputClass} value={featured} onChange={(event) => setFeatured(event.target.value)}>
          <option value="">— Banner mặc định —</option>
          {productions.map((item) => (
            <option key={item.id} value={item.id}>{item.title} ({item.release_year || "?"})</option>
          ))}
        </select>
        {(featuredInfo || featured) && (
          <p className="text-xs text-slate-500">
            Đang chọn: <strong>{productions.find((item) => String(item.id) === featured)?.title || featuredInfo?.title || "—"}</strong>
          </p>
        )}
        {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu banner"}
        </button>
      </form>

      <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Xuất dữ liệu (CSV)</h2>
        <p className="text-sm text-slate-500">Tải danh sách phục vụ báo cáo — mở được bằng Excel (có BOM UTF-8).</p>
        <div className="flex gap-2">
          <button type="button" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => downloadCsv("users")}>⬇ Danh sách người dùng</button>
          <button type="button" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => downloadCsv("transactions")}>⬇ Giao dịch</button>
        </div>
      </div>

      <div className="max-w-xl space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Về phân quyền hệ quản trị</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li><strong>Admin</strong>: toàn quyền — quản lý người dùng, nội dung, kinh doanh, nhật ký, cài đặt.</li>
          <li><strong>Moderator</strong>: chỉ quản lý nội dung (phim/tập, bình luận, đánh giá, watch party, thống kê). Không xem được người dùng/doanh thu/nhật ký.</li>
          <li>Cấp quyền moderator cho một user ở trang <em>Quản lý người dùng</em> (dropdown Vai trò).</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsAdminPage;
