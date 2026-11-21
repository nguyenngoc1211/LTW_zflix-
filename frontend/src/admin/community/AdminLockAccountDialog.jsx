import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import AdminModal from '../ui/AdminModal.jsx';

export default function AdminLockAccountDialog({ target, onClose, onLocked }) {
  const { apiRequest } = useAuth();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/v1/admin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'disabled', reason: reason.trim() }),
      });
      onLocked(target);
      onClose();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <AdminModal title="Khóa tài khoản" onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit} className="admin-account-lock-form">
      <p>Khóa tài khoản <strong>{target.username || `#${target.id}`}</strong>? Người dùng sẽ không thể đăng nhập hoặc tiếp tục dùng phiên hiện tại. Nội dung cũ vẫn được giữ nguyên.</p>
      <label htmlFor="admin-lock-reason">Lý do khóa tài khoản</label>
      <textarea id="admin-lock-reason" required minLength={10} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do để lưu vào nhật ký kiểm duyệt" />
      {error && <p role="alert" className="admin-content-error">{error}</p>}
      <div className="admin-content-actions"><button type="button" onClick={onClose} disabled={busy}>Hủy</button><button type="submit" className="admin-content-primary" disabled={busy || reason.trim().length < 10}>{busy ? 'Đang khóa...' : 'Xác nhận khóa'}</button></div>
    </form>
  </AdminModal>;
}
