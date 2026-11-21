import { useState } from 'react';
import { createPortal } from 'react-dom';

const reasons = [
  ['spam', 'Spam'],
  ['harassment', 'Quấy rối'],
  ['inappropriate', 'Ngôn từ không phù hợp'],
  ['spoiler', 'Spoiler'],
  ['other', 'Khác'],
];

function Dialog({ title, children, onClose }) {
  return createPortal(<div className="community-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="community-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header>{children}</section></div>, document.body);
}

export function DeleteContentDialog({ kind, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); onClose(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <Dialog title={`Xóa ${kind}`} onClose={busy ? () => {} : onClose}><p>Bạn có chắc muốn xóa {kind} này? Nội dung và điểm liên quan sẽ được hệ thống xử lý.</p>{error && <p role="alert" className="community-dialog-error">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="button" className="is-danger" disabled={busy} onClick={confirm}>{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</button></footer></Dialog>;
}

export function ReportContentDialog({ kind, onSubmit, onClose }) {
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await onSubmit({ reason, description: description.trim() }); onClose(); }
    catch (cause) { setError(cause.status === 409 ? 'Bạn đã báo cáo nội dung này.' : cause.message); }
    finally { setBusy(false); }
  };
  return <Dialog title={`Báo cáo ${kind}`} onClose={busy ? () => {} : onClose}><form onSubmit={submit}><label>Lý do<select value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Mô tả thêm (không bắt buộc)<textarea rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Cung cấp thêm thông tin cho quản trị viên" /></label>{error && <p role="alert" className="community-dialog-error">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="is-primary" disabled={busy}>{busy ? 'Đang gửi...' : 'Gửi báo cáo'}</button></footer></form></Dialog>;
}
