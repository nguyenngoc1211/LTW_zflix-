import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import UserAvatar from '../../components/UserAvatar.jsx';

export default function ProfilePage() {
  const { user, updateAvatar } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const selectFile = (event) => {
    const selected = event.target.files?.[0];
    setFile(null); setPreview(null); setMessage('');
    if (!selected) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024) {
      setMessage('Chọn ảnh PNG, JPEG hoặc WebP không quá 5 MB.');
      event.target.value = '';
      return;
    }
    setFile(selected); setPreview(URL.createObjectURL(selected));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true); setMessage('');
    try { await updateAvatar(file); setFile(null); setPreview(null); event.target.reset(); setMessage('Đã cập nhật ảnh đại diện.'); }
    catch (error) { setMessage(error.message || 'Không thể tải ảnh lên.'); }
    finally { setBusy(false); }
  };
  return <section className="text-white">
    <h1 className="text-2xl font-bold">Hồ sơ cá nhân</h1>
    <div className="mt-6 flex items-center gap-4"><UserAvatar src={preview || user?.avatarUrl} className="h-20 w-20 rounded-full object-cover" alt={preview ? 'Ảnh đại diện xem trước' : 'Ảnh đại diện'} /><div><p className="font-semibold">{user?.username}</p><p className="break-all text-sm text-zinc-400">{user?.email}</p>{preview && <p className="text-sm text-zinc-400">Ảnh xem trước</p>}</div></div>
    <form className="mt-6 space-y-3" onSubmit={submit}>
      <label className="block">Chọn ảnh đại diện<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} className="mt-2 block text-sm" /></label>
      <p className="text-sm text-zinc-400">PNG, JPEG hoặc WebP, tối đa 5 MB.</p>
      <button type="submit" disabled={!file || busy} className="rounded bg-red-600 px-4 py-2 disabled:opacity-50">{busy ? 'Đang tải...' : 'Cập nhật ảnh'}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
