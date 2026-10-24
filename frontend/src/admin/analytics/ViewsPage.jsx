import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value || 0));
const shortDate = (value) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

const ViewsPage = () => {
  const { apiRequest } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/admin/views")
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [apiRequest]);

  if (error) return <p className="alert">{error}</p>;
  if (!data) return <p className="text-slate-500">Đang tải thống kê lượt xem...</p>;

  const maxViews = Math.max(...data.daily.map((day) => day.total_views), 1);
  const maxTop = Math.max(...data.topProductions.map((item) => item.view_count), 1);
  const maxActive = Math.max(...data.daily.map((day) => day.active_users), 1);

  // Pie thể loại: dựng bằng conic-gradient, không cần thư viện
  const totalGenreViews = data.byGenre.reduce((sum, item) => sum + item.view_count, 0) || 1;
  const PIE_COLORS = ["#e50914", "#7c3aed", "#3b82f6", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#64748b"];
  const pieStops = data.byGenre
    .reduce(
      (acc, item, index) => {
        const end = acc.end + item.view_count / totalGenreViews;
        acc.stops.push(`${PIE_COLORS[index % PIE_COLORS.length]} ${acc.end * 100}% ${end * 100}%`);
        return { stops: acc.stops, end };
      },
      { stops: [], end: 0 },
    )
    .stops;
  const pieStyle = { background: `conic-gradient(${pieStops.join(", ")})` };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Thống kê lượt xem</h1>
        <p className="text-sm text-slate-500">30 ngày gần nhất từ bảng daily_stats và lượt xem thật từ watch_history</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Lượt xem theo ngày</h2>
        <div className="mt-4 flex h-48 items-end gap-1">
          {data.daily.map((day) => (
            <div key={day.stat_date} className="group relative flex-1" title={`${shortDate(day.stat_date)}: ${formatNumber(day.total_views)} lượt`}>
              <div
                className="w-full rounded-t bg-red-500 transition-all group-hover:bg-red-600"
                style={{ height: `${Math.max(4, (day.total_views / maxViews) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>{shortDate(data.daily[0]?.stat_date)}</span>
          <span>{shortDate(data.daily[data.daily.length - 1]?.stat_date)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Người dùng hoạt động &amp; người dùng mới</h2>
        <p className="text-xs text-slate-500">Cột xanh: người dùng hoạt động trong ngày · Chấm đỏ: người dùng mới</p>
        <div className="mt-4 flex h-40 items-end gap-1">
          {data.daily.map((day) => (
            <div key={day.stat_date} className="group relative flex-1" title={`${shortDate(day.stat_date)}: ${formatNumber(day.active_users)} hoạt động · ${formatNumber(day.new_users)} mới`}>
              <div
                className="w-full rounded-t bg-indigo-400 transition-all group-hover:bg-indigo-500"
                style={{ height: `${Math.max(4, (day.active_users / maxActive) * 100)}%` }}
              />
              <div
                className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-red-500"
                style={{ bottom: `${Math.max(2, (day.new_users / maxActive) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>{shortDate(data.daily[0]?.stat_date)}</span>
          <span>{shortDate(data.daily[data.daily.length - 1]?.stat_date)}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Top 10 phim được xem nhiều nhất</h2>
          <p className="text-xs text-slate-500">Đếm từ watch_history thật của người dùng</p>
          <ul className="mt-3 space-y-3">
            {data.topProductions.length === 0 && <li className="text-sm text-slate-500">Chưa có lượt xem nào.</li>}
            {data.topProductions.map((item, index) => (
              <li key={item.id}>
                <div className="flex justify-between text-sm">
                  <Link to={`/movies/${item.id}`} className="font-medium text-slate-800 hover:text-red-600">
                    {index + 1}. {item.title}
                  </Link>
                  <span className="text-slate-500">{formatNumber(item.view_count)} lượt · {item.avg_completion}% HT</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-red-500" style={{ width: `${(item.view_count / maxTop) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Tỷ trọng lượt xem theo thể loại</h2>
          <p className="text-xs text-slate-500">8 thể loại được xem nhiều nhất</p>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="relative h-40 w-40 shrink-0 rounded-full" style={pieStyle} title="Phân bố lượt xem theo thể loại">
              <div className="absolute inset-[30%] rounded-full bg-white" />
            </div>
            <ul className="min-w-40 flex-1 space-y-1.5">
              {data.byGenre.map((item, index) => (
                <li key={item.genre} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                    {item.genre}
                  </span>
                  <span className="text-slate-500">{Math.round((item.view_count / totalGenreViews) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewsPage;
