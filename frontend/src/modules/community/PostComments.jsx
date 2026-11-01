import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';

function Thread({ postId, parentId, depth, user, onChanged }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [revealed, setRevealed] = useState({});
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const base = `/api/v1/community/posts/${postId}/comments`;
  const load = useCallback(async () => {
    try { const data = await apiRequest(`${base}?page=${page}${parentId ? `&parentId=${parentId}` : ''}`); setItems(data.items); setMore(data.hasMore); setError(''); }
    catch (err) { setError(err.message); }
  }, [base, page, parentId]);
  useEffect(() => {
    let active = true;
    apiRequest(`${base}?page=${page}${parentId ? `&parentId=${parentId}` : ''}`).then((data) => {
      if (active) { setItems(data.items); setMore(data.hasMore); setError(''); }
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [base, page, parentId]);
  const submit = async (e) => {
    e.preventDefault();
    try { await apiRequest(base, { method: 'POST', body: JSON.stringify({ content: text, isSpoiler: spoiler, ...(parentId && { parentId }) }) }); setText(''); setSpoiler(false); setPage(1); await load(); onChanged(); }
    catch (err) { setError(err.message); }
  };
  const remove = async (id) => {
    try { await apiRequest(`${base}/${id}`, { method: 'DELETE' }); await load(); onChanged(); }
    catch (err) { setError(err.message); }
  };
  const saveEdit = async (id) => {
    try { await apiRequest(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify({ content: editText }) }); setEditing(null); await load(); }
    catch (err) { setError(err.message); }
  };
  return <div className={depth ? 'ml-4 border-l border-zinc-700 pl-3 space-y-3' : 'space-y-3'}>
    {user && <form onSubmit={submit} className="space-y-2"><textarea required maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder={parentId ? 'Viết trả lời...' : 'Viết bình luận...'} className="w-full rounded border border-zinc-700 bg-zinc-950 p-2" /><label className="flex gap-2 text-sm"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />Tiết lộ nội dung phim</label><button className="rounded bg-pink-700 px-3 py-1 text-sm">Gửi</button></form>}
    {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
    {items.map((item) => <div key={item.id} className="space-y-2 rounded bg-zinc-900 p-3"><div className="text-xs text-zinc-400">Thành viên #{item.author_id} · {new Date(item.created_at).toLocaleString('vi-VN')}</div>{editing === item.id ? <div className="space-y-2"><textarea maxLength={3000} value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-950 p-2" /><button onClick={() => saveEdit(item.id)}>Lưu</button><button className="ml-3" onClick={() => setEditing(null)}>Hủy</button></div> : item.is_spoiler && !revealed[item.id] && item.status === 'active' ? <button className="text-amber-300 text-sm" onClick={() => setRevealed({ ...revealed, [item.id]: true })}>Nhấn để xem spoiler</button> : <p className="whitespace-pre-wrap break-words">{item.content}</p>}<div className="flex gap-4 text-sm text-zinc-400">{depth < 3 && <button onClick={() => setExpanded({ ...expanded, [item.id]: !expanded[item.id] })}>{expanded[item.id] ? 'Ẩn trả lời' : 'Xem / trả lời'}</button>}{item.status === 'active' && user?.id === item.author_id && <><button onClick={() => { setEditing(item.id); setEditText(item.content); }}>Sửa</button><button onClick={() => remove(item.id)}>Xóa</button></>}</div>{expanded[item.id] && <Thread postId={postId} parentId={item.id} depth={depth + 1} user={user} onChanged={onChanged} />}</div>)}
    {(page > 1 || more) && <div className="flex gap-3 text-sm"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button><span>{page}</span><button disabled={!more} onClick={() => setPage(page + 1)}>Sau</button></div>}
  </div>;
}

export default function PostComments({ postId, user, onChanged }) {
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Bình luận</h2><Thread postId={postId} depth={0} user={user} onChanged={onChanged} /></section>;
}
