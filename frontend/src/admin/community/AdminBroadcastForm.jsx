import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';

export default function AdminBroadcastForm() {
  const { apiRequest } = useAuth();
  const [form, setForm] = useState({ title: '', message: '', redirectUrl: '' });
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!window.confirm('Gửi thông báo này tới tất cả người dùng đang hoạt động?')) return;
    setSending(true); setError('');
    try {
      const response = await apiRequest('/api/v1/admin/notifications/broadcast', { method: 'POST', body: JSON.stringify(form) });
      setResult(`Đã gửi thông báo tới ${response.sent} người dùng đang hoạt động.`);
      setForm({ title: '', message: '', redirectUrl: '' });
    } catch (cause) { setError(cause.message); }
    finally { setSending(false); }
  };
  return <form className="space-y-4" onSubmit={submit}><p className="text-sm text-slate-400">Thông báo được gửi tới tất cả tài khoản đang hoạt động.</p><label className="block text-sm">Tiêu đề<input className="mt-1 w-full rounded-lg border p-2" required maxLength={255} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label><label className="block text-sm">Nội dung<textarea className="mt-1 min-h-28 w-full rounded-lg border p-2" required maxLength={1000} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} /></label><label className="block text-sm">Đường dẫn khi mở thông báo (tùy chọn)<input className="mt-1 w-full rounded-lg border p-2" value={form.redirectUrl} onChange={(event) => setForm((current) => ({ ...current, redirectUrl: event.target.value }))} placeholder="/movies/3" /></label>{error && <p role="alert" className="admin-content-error">{error}</p>}{result && <p role="status" className="admin-content-success">{result}</p>}<button className="admin-content-primary" disabled={sending}>{sending ? 'Đang gửi...' : 'Gửi thông báo'}</button></form>;
}
