import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "—");

const StatCard = ({ label, value, hint, accent }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${accent || "text-slate-900"}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

const DashboardPage = () => {
  const { apiRequest } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/admin/stats")
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [apiRequest]);

  if (error) return <p className="alert">{error}</p>;
  if (!stats) return <p className="text-slate-500">Đang tải số liệu...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h1>
        <p className="text-sm text-slate-500">Số liệu toàn nền tảng Zflix (nguồn: daily_stats + dữ liệu thật)</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Người dùng" value={formatNumber(stats.totalUsers)} hint="tài khoản đã đăng ký" />
        <StatCard label="Phim / Tập" value={`${formatNumber(stats.totalProductions)} / ${formatNumber(stats.totalEpisodes)}`} hint="đang có trên hệ thống" />
        <StatCard label="Tổng lượt xem" value={formatNumber(stats.totalViews)} accent="text-red-600" hint="tổng cộng từ daily_stats" />
        <StatCard label="Doanh thu" value={`${formatNumber(stats.totalRevenue)} ₫`} accent="text-emerald-600" hint="tổng từ daily_stats" />
        <StatCard label="Đánh giá" value={formatNumber(stats.totalRatings)} hint={`điểm trung bình ${stats.avgRating}/5`} />
        <StatCard label="Bình luận" value={formatNumber(stats.totalComments)} />
        <StatCard label="Thời gian xem" value={`${formatNumber(Math.round(stats.totalWatchTime / 3600))} giờ`} hint="tổng thời lượng xem" />
        <StatCard label="Tỷ lệ hoàn thành TB" value={`${stats.avgRating > 0 ? stats.avgRating : 0} / 5`} hint="điểm hài lòng trung bình" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Người dùng mới nhất</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-2">Tên đăng nhập</th>
              <th className="py-2">Email</th>
              <th className="py-2">Vai trò</th>
              <th className="py-2">Trạng thái</th>
              <th className="py-2">Ngày tham gia</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentUsers.map((user) => (
              <tr key={user.id} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-800">{user.username}</td>
                <td className="py-2 text-slate-600">{user.email}</td>
                <td className="py-2">{user.role === "admin" ? "Admin" : "User"}</td>
                <td className="py-2">
                  <span className={user.status === "active" ? "text-emerald-600" : "text-red-600"}>
                    {user.status === "active" ? "Hoạt động" : "Bị khóa"}
                  </span>
                </td>
                <td className="py-2 text-slate-500">{formatDate(user.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;
