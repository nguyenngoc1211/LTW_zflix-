import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';

const options = [
  ['episode_updates', 'Tập phim mới'],
  ['comment_replies', 'Trả lời bình luận'],
  ['post_comments', 'Bình luận bài viết'],
  ['mentions', 'Nhắc đến tôi'],
  ['likes', 'Lượt thích'],
  ['vip_reminders', 'Nhắc hạn VIP'],
];

export default function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    apiRequest('/api/v1/notifications/preferences')
      .then((result) => { if (active) { setPreferences(result.preferences); setLoading(false); setError(''); } })
      .catch((err) => { if (active) { setError(err.message); setLoading(false); } });
    return () => { active = false; };
  }, [reload]);
  const toggle = async (key) => {
    if (!preferences || saving) return;
    const previous = preferences;
    const value = !previous[key];
    setPreferences({ ...previous, [key]: value });
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await apiRequest('/api/v1/notifications/preferences', {
        method: 'PATCH', body: JSON.stringify({ [key]: value }),
      });
      setPreferences(result.preferences);
      setMessage('Đã lưu cài đặt thông báo.');
    } catch (err) {
      try { setPreferences((await apiRequest('/api/v1/notifications/preferences')).preferences); }
      catch { setPreferences(previous); }
      setError(`Không lưu được: ${err.message}`);
    } finally { setSaving(false); }
  };
  return <section className="notification-preferences">
    <h2>Thông báo</h2>
    <p>Thông báo bảo mật, giao dịch và quản trị vẫn luôn được gửi.</p>
    {error && <p role="alert" className="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!preferences && (loading ? <p>Đang tải cài đặt thông báo...</p> : <button type="button" onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Thử lại</button>)}
    {preferences && options.map(([key, label]) =>
      <label key={key} className="notification-preference-row"><span>{label}</span>
        <input type="checkbox" checked={preferences[key]} disabled={saving} onChange={() => toggle(key)} />
      </label>)}
  </section>;
}
