import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import UserAvatar from './UserAvatar.jsx';

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  const onKeys = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = [...root.current.querySelectorAll('[data-account-action]')];
    if (!options.length) return;
    event.preventDefault();
    const current = options.indexOf(document.activeElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? (current + 1) % options.length : (current <= 0 ? options.length - 1 : current - 1);
    options[index].focus();
  };
  const signOut = async () => {
    setOpen(false);
    try { await logout(); } catch { /* AuthContext still clears local authentication state. */ }
    finally { navigate('/login', { replace: true }); }
  };
  if (!user) return null;
  return <div className="account-menu" ref={root} onKeyDown={onKeys}>
    <button ref={trigger} type="button" className="account-trigger" aria-expanded={open} aria-controls="account-dropdown" aria-label={`Tài khoản ${user.username}`} onClick={() => setOpen((value) => !value)}>
      <UserAvatar src={user.avatarUrl} className="account-avatar" />
      <span className="account-username">{user.username}</span>
      <span aria-hidden="true" className="account-chevron">⌄</span>
    </button>
    {open && <div id="account-dropdown" className="account-dropdown">
      <div className="account-summary"><UserAvatar src={user.avatarUrl} className="account-avatar" /><span className="account-summary-name">{user.username}</span></div>
      <Link data-account-action to="/settings?tab=profile" onClick={() => setOpen(false)}>Cài đặt tài khoản</Link>
      <button data-account-action type="button" onClick={signOut}>Đăng xuất</button>
    </div>}
  </div>;
}
