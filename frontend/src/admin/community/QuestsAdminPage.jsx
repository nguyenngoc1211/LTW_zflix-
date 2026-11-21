import { useEffect, useState } from 'react';
import { message } from 'antd';
import { apiRequest } from '../../services/api.js';
import AdminModal from '../ui/AdminModal.jsx';

const emptyQuest = { id: '', title: '', cadence: 'daily', action: 'post', target: 1, points: 5, enabled: true };
const emptyBadge = { id: '', title: '', description: '', icon: '★', action: 'post', target: 1, enabled: true };
const input = 'mt-1 block w-full rounded-lg border p-2 text-sm';
export default function QuestsAdminPage() {
  const [data, setData] = useState({ quests: [], achievements: [] });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => apiRequest('/api/v1/admin/quests/definitions').then((result) => { setData(result); setError(''); }).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  useEffect(() => { apiRequest('/api/v1/admin/quests/definitions').then(setData).catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }, []);
  const save = async (kind, value, reason) => {
    try { await apiRequest(`/api/v1/admin/quests/definitions/${kind}/${value.id}`, { method: 'PUT', body: JSON.stringify({ ...value, reason }) }); setEditing(null); message.success('Đã lưu cấu hình.'); await load(); }
    catch (cause) { setError(cause.message); message.error(cause.message); }
  };
  return <div className="space-y-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Nhiệm vụ & huy hiệu</h2><p className="text-sm text-slate-500">Điểm thưởng và tiến độ dùng giao dịch Points hợp lệ.</p></div></div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{loading && <p className="text-slate-500">Đang tải cấu hình...</p>}
    <DefinitionList title="Nhiệm vụ ngày & tuần" items={data.quests} kind="quests" onEdit={(item) => setEditing({ kind: 'quests', value: item })} onCreate={() => setEditing({ kind: 'quests', value: emptyQuest })} />
    <DefinitionList title="Huy hiệu thành tựu" items={data.achievements} kind="achievements" onEdit={(item) => setEditing({ kind: 'achievements', value: item })} onCreate={() => setEditing({ kind: 'achievements', value: emptyBadge })} />
    {editing && <AdminModal title={editing.value.id ? `Chỉnh sửa ${editing.kind === 'quests' ? 'nhiệm vụ' : 'huy hiệu'}` : `Tạo ${editing.kind === 'quests' ? 'nhiệm vụ' : 'huy hiệu'}`} onClose={() => setEditing(null)}><DefinitionEditor key={`${editing.kind}:${editing.value.id}`} kind={editing.kind} initial={editing.value} onSave={(value, reason) => save(editing.kind, value, reason)} /></AdminModal>}
  </div>;
}
function DefinitionList({ title, items, kind, onEdit, onCreate }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">{title}</h3><button className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white" onClick={onCreate}>+ Tạo {kind === 'quests' ? 'nhiệm vụ' : 'huy hiệu'}</button></div>{items.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{items.map((item) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div className="min-w-0"><strong className="block truncate text-sm">{kind === 'achievements' && <span className="mr-2 text-red-600">{item.icon}</span>}{item.title}</strong><small className="text-slate-500">{item.cadence ? `${item.cadence} · ` : ''}{item.action} · {item.target} lần{item.points !== undefined ? ` · +${item.points} điểm` : ''}</small><span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${item.enabled ? 'bg-emerald-900/30 text-emerald-600' : 'bg-slate-700 text-slate-400'}`}>{item.enabled ? 'Đang bật' : 'Đã tắt'}</span></div><button className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-xs" onClick={() => onEdit(item)}>Sửa</button></article>)}</div> : <p className="mt-4 text-sm text-slate-500">Chưa có cấu hình.</p>}</section>;
}
function DefinitionEditor({ kind, initial, onSave }) {
  const [value, setValue] = useState(initial);
  const [reason, setReason] = useState('');
  const set = (key, next) => setValue((current) => ({ ...current, [key]: next }));
  const submit = (event) => { event.preventDefault(); onSave(value, reason); };
  return <form className="grid gap-4" onSubmit={submit}><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Mã định danh<input className={input} value={value.id} disabled={Boolean(initial.id)} onChange={(event) => set('id', event.target.value)} required pattern="[a-z][a-z0-9_]{2,39}" /></label><label className="text-sm">Tên<input className={input} value={value.title} onChange={(event) => set('title', event.target.value)} required minLength={5} maxLength={100} /></label>{kind === 'quests' && <label className="text-sm">Chu kỳ<select className={input} value={value.cadence} onChange={(event) => set('cadence', event.target.value)}><option value="daily">Ngày</option><option value="weekly">Tuần</option></select></label>}{kind === 'achievements' && <label className="text-sm">Biểu tượng<input className={input} value={value.icon} onChange={(event) => set('icon', event.target.value)} maxLength={8} required /></label>}<label className="text-sm">Hoạt động<select className={input} value={value.action} onChange={(event) => set('action', event.target.value)}>{['post', 'review', 'comment', 'upvote', ...(kind === 'achievements' ? ['top10'] : [])].map((action) => <option key={action} value={action}>{action}</option>)}</select></label><label className="text-sm">Mục tiêu<input className={input} type="number" min="1" max={kind === 'quests' ? 100 : 10000} value={value.target} onChange={(event) => set('target', Number(event.target.value))} required /></label>{kind === 'quests' ? <label className="text-sm">Điểm thưởng<input className={input} type="number" min="0" max="100" value={value.points} onChange={(event) => set('points', Number(event.target.value))} required /></label> : <label className="text-sm sm:col-span-2">Mô tả<input className={input} value={value.description} onChange={(event) => set('description', event.target.value)} maxLength={200} /></label>}</div><label className="text-sm"><input type="checkbox" checked={value.enabled} onChange={(event) => set('enabled', event.target.checked)} /> <span className="ml-2">Đang hoạt động</span></label><label className="text-sm">Lý do thay đổi<input className={input} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} maxLength={500} /></label><button className="justify-self-end rounded-lg bg-red-700 px-5 py-2 text-white" type="submit">Lưu cấu hình</button></form>;
}
