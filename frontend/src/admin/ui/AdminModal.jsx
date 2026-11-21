import { useEffect } from 'react';

export default function AdminModal({ title, children, onClose, size = 'medium' }) {
  useEffect(() => { const close = (event) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`admin-modal admin-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" aria-label="Đóng" onClick={onClose}>✕</button></header><div className="admin-modal-body">{children}</div></section></div>;
}
