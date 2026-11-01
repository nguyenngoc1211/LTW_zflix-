import { useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.js';

export default function ScreenshotComposer({ videoRef, productionId, productionTitle, episode, onPublished }) {
  const { user } = useAuth();
  const [capture, setCapture] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [communityId, setCommunityId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { if (capture) URL.revokeObjectURL(capture.url); setCapture(null); };
  const take = () => {
    setError('');
    if (!user) { setError('Vui lòng đăng nhập để chia sẻ khoảnh khắc.'); return; }
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) { setError('Video chưa sẵn sàng để chụp.'); return; }
    try {
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const timestamp = video.currentTime;
      canvas.toBlob((blob) => {
        if (!blob) { setError('Không thể tạo ảnh từ khung hình này.'); return; }
        setCapture({ blob, url: URL.createObjectURL(blob), timestamp, episodeId: episode.id, productionId });
      }, 'image/png');
    } catch { setError('Nguồn video không cho phép chụp khung hình (CORS hoặc bảo vệ nội dung).'); }
  };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('post', JSON.stringify({ type: 'screenshot', title, content, isSpoiler: spoiler, productionId: capture.productionId, episodeId: capture.episodeId, timestampSeconds: capture.timestamp, ...(communityId && { communityId: Number(communityId) }) }));
      form.append('images', capture.blob, 'screenshot.png');
      await apiRequest('/api/v1/community/posts/with-images', { method: 'POST', body: form });
      close(); setTitle(''); setContent(''); setSpoiler(false); setCommunityId(''); onPublished?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <><button type="button" onClick={take} className="rounded bg-zinc-700 px-3 py-2 text-sm text-white">📷 Chụp khoảnh khắc</button>{error && !capture && <span role="alert" className="text-xs text-red-300">{error}</span>}{capture && <div role="dialog" aria-modal="true" aria-labelledby="screenshot-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-zinc-900 p-5 text-white space-y-3"><h2 id="screenshot-title" className="text-lg font-bold">Chia sẻ khoảnh khắc</h2><img src={capture.url} alt="Khung hình vừa chụp" className="max-h-56 mx-auto" /><p className="text-sm">{productionTitle || `Phim #${capture.productionId}`} · Tập {episode.episode_number} · {Math.floor(capture.timestamp / 60)}:{String(Math.floor(capture.timestamp % 60)).padStart(2, '0')}</p><label className="block">Tiêu đề<input required maxLength={200} className="block w-full bg-zinc-800 p-2" value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="block">Nội dung<textarea maxLength={10000} className="block w-full bg-zinc-800 p-2" value={content} onChange={(e) => setContent(e.target.value)} /></label><label className="block">Mã cộng đồng (không bắt buộc)<input type="number" min="1" step="1" value={communityId} onChange={(e) => setCommunityId(e.target.value)} className="block w-full bg-zinc-800 p-2" /></label><label className="flex gap-2"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />Có spoiler</label>{error && <p role="alert" className="text-red-300">{error}</p>}<div className="flex gap-3"><button disabled={busy} className="rounded bg-pink-700 px-4 py-2">{busy ? 'Đang đăng...' : 'Đăng'}</button><button type="button" disabled={busy} onClick={close}>Hủy</button></div></form></div>}</>;
}
