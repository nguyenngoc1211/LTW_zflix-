import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';

const fmt = (value) => new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
const labels = { PENDING: 'Chưa xác nhận', WAITING_REVIEW: 'Chờ duyệt', PAID: 'Đã duyệt', REJECTED: 'Từ chối' };
export default function VipPaymentsAdminPage() {
  const { apiRequest } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('WAITING_REVIEW');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (search.trim()) query.set('search', search.trim());
    const data = await apiRequest(`/api/v1/admin/vip-payments/orders?${query}`);
    setOrders(data.orders);
  }, [apiRequest, status, search]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);
  const review = async (decision) => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await apiRequest(`/api/v1/admin/vip-payments/orders/${selected.id}/review`, {
        method: 'POST', body: JSON.stringify({ decision, reason }),
      });
      setSelected(null); setReason(''); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="space-y-5 rounded-xl bg-[#111115] p-5 text-white">
    <div><h1 className="text-2xl font-bold">Xét duyệt thanh toán VIP</h1><p className="text-sm text-gray-400">Đối chiếu chuyển khoản trước khi duyệt. QR demo không xác nhận tiền thật.</p></div>
    {error && <p role="alert" className="rounded bg-red-900 p-3">{error}</p>}
    <div className="flex flex-wrap gap-3"><input aria-label="Tìm đơn, người dùng" placeholder="Mã đơn, tên hoặc email" className="min-w-52 flex-1 rounded bg-[#25252b] p-2" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Lọc trạng thái" className="rounded bg-[#25252b] p-2" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Tất cả</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    <div className="grid gap-3">{orders.map((order) => <button key={order.id} onClick={() => setSelected(order)} className="flex flex-wrap justify-between gap-2 rounded-lg border border-[#444] bg-[#202025] p-4 text-left hover:border-red-600">
      <span><strong>{order.code}</strong><small className="block text-gray-400">{order.username} · {order.email} · {order.planName}</small></span><span>{fmt(order.amount)}<small className="block text-red-400">{labels[order.status]}</small></span>
    </button>)}</div>
    {orders.length === 0 && <p className="text-gray-400">Không có đơn phù hợp.</p>}
    {selected && <div className="rounded-lg border border-red-900 bg-[#1c1719] p-5">
      <div className="flex justify-between gap-3"><h2 className="text-xl font-semibold">{selected.code}</h2><button onClick={() => setSelected(null)} aria-label="Đóng">✕</button></div>
      <p>{selected.username} ({selected.email}) · {selected.planName} · {fmt(selected.amount)}</p>
      <p>Trạng thái: {labels[selected.status]} · Tạo: {new Date(selected.createdAt).toLocaleString('vi-VN')}</p>
      <p>Ngân hàng: {selected.bank?.mode === 'DEMO' ? 'QR DEMO — không có chuyển khoản thật' : `${selected.bank?.bankName} · ${selected.bank?.account} · ${selected.bank?.accountName}`}</p>
      <p>Nội dung chuyển khoản: {selected.code}</p>
      {selected.rejectionReason && <p>Lý do từ chối: {selected.rejectionReason}</p>}
      <div className="mt-3 text-sm text-gray-400">Lịch sử: {selected.history.map((entry) => `${entry.action} (${new Date(entry.at).toLocaleString('vi-VN')}, ID ${entry.actor_id})`).join(' → ')}</div>
      {selected.status === 'WAITING_REVIEW' && <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} className="rounded bg-red-600 px-5 py-2 font-bold disabled:opacity-50" onClick={() => review('approve')}>Duyệt và cấp VIP</button>
        <input className="min-w-48 flex-1 rounded bg-[#29292d] p-2" placeholder="Lý do từ chối (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button disabled={busy || reason.trim().length < 5} className="rounded border border-red-500 px-5 py-2 disabled:opacity-50" onClick={() => review('reject')}>Từ chối</button></div>}
    </div>}
  </div>;
}
