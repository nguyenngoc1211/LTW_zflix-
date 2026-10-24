import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

const PartiesAdminPage = () => {
  const { apiRequest, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [onlyActive, setOnlyActive] = useState(false);

  const load = () => {
    setLoading(true);
    apiRequest("/api/v1/admin/parties")
      .then((data) => setItems(data.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endParty = async (party) => {
    if (!window.confirm(`Kết thúc phòng "${party.title}"?`)) return;
    setError("");
    try {
      await apiRequest(`/api/v1/admin/parties/${party.id}/end`, { method: "PATCH" });
      setMessage(`Đã kết thúc phòng ${party.id}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteParty = async (party) => {
    if (!window.confirm(`Xóa hẳn phòng "${party.title}" (kèm chat + thành viên)?`)) return;
    setError("");
    try {
      await apiRequest(`/api/v1/admin/parties/${party.id}`, { method: "DELETE" });
      setMessage(`Đã xóa phòng ${party.id}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const visible = onlyActive ? items.filter((item) => item.status !== "ended") : items;
  const statusLabel = { waiting: "Chờ bắt đầu", playing: "Đang chiếu", paused: "Tạm dừng", ended: "Đã kết thúc" };
  const statusColor = { waiting: "text-amber-600", playing: "text-emerald-600", paused: "text-slate-500", ended: "text-red-500" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Watch Party</h1>
          <p className="text-sm text-slate-500">Theo dõi và kết thúc các phòng xem chung nếu cần</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />
          Chỉ hiện phòng đang hoạt động
        </label>
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Mã phòng</th>
              <th className="px-4 py-3">Phòng / Phim</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Người</th>
              <th className="px-4 py-3">Chat</th>
              <th className="px-4 py-3">Tạo lúc</th>
              <th className="px-4 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-slate-500" colSpan="8">Đang tải...</td></tr>}
            {!loading && visible.length === 0 && <tr><td className="px-4 py-6 text-slate-500" colSpan="8">Không có phòng nào.</td></tr>}
            {!loading && visible.map((party) => (
              <tr key={party.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-mono font-medium text-slate-700">#{party.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{party.title}</p>
                  <p className="text-xs text-slate-500">{party.production_title}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{party.host_name}</td>
                <td className={`px-4 py-3 font-medium ${statusColor[party.status]}`}>{statusLabel[party.status] || party.status}</td>
                <td className="px-4 py-3 text-slate-600">{party.participant_count}/{party.max_participants}</td>
                <td className="px-4 py-3 text-slate-600">{party.chat_count}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(party.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {party.status !== "ended" && (
                      <button type="button" className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600" onClick={() => endParty(party)}>Kết thúc</button>
                    )}
                    {isAdmin && (
                      <button type="button" className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700" onClick={() => deleteParty(party)}>Xóa</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartiesAdminPage;
