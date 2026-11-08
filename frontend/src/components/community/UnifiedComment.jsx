import { useEffect, useRef, useState } from 'react';
import UserAvatar from '../UserAvatar.jsx';
import MentionTextarea from './MentionTextarea.jsx';

export function CommentFrame({ avatar, username, date, children }) {
  const time = new Date(date);
  return <article className="movie-comment"><UserAvatar src={avatar} className="movie-comment-avatar" /><div className="movie-comment-main"><div className="movie-comment-meta"><strong>{username}</strong>{!Number.isNaN(time.getTime()) && <time dateTime={time.toISOString()}>{time.toLocaleString('vi-VN')}</time>}</div>{children}</div></article>;
}

export function SpoilerContent({ spoiler, children }) {
  const [revealed, setRevealed] = useState(false);
  if (!spoiler) return children;
  return <>{revealed && children}<div className="movie-comment-actions"><button type="button" onClick={() => setRevealed(!revealed)}>{revealed ? 'Ẩn nội dung spoiler' : 'Hiện nội dung spoiler'}</button></div></>;
}

export function CommentForm({ onSubmit, text, onText, spoiler, onSpoiler, busy, onCancel, label = 'Viết bình luận...' }) {
  return <form className="movie-reply-form" onSubmit={onSubmit}><label>{label}<MentionTextarea value={text} onChange={onText} required maxLength={3000} rows={2} /></label>{onSpoiler && <label className="movie-spoiler-option"><input type="checkbox" checked={spoiler} onChange={(event) => onSpoiler(event.target.checked)} /> Nội dung có spoiler</label>}<div className="movie-comment-actions"><button type="submit" disabled={busy || !text.trim()}>{busy ? 'Đang gửi...' : 'Gửi'}</button>{onCancel && <button type="button" onClick={onCancel}>Hủy</button>}</div></form>;
}

export function CommentPagination({ page, more, loading = false, onPage }) {
  return <nav className="comment-pagination" aria-label="Phân trang bình luận"><button type="button" disabled={loading || page === 1} onClick={() => onPage(page - 1)}>‹ Trước</button><span aria-current="page">{page}</span><button type="button" disabled={loading || !more} onClick={() => onPage(page + 1)}>Sau ›</button></nav>;
}

export function CommentActions({ user, upvotes = 0, downvotes = 0, vote, onVote, voteBusy = false, onReply, canReply, menuItems = [], children }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="movie-comment-actions">{user ? <button type="button" aria-label="Ủng hộ" aria-pressed={vote === 1} disabled={voteBusy} onClick={() => onVote(1)}>↑ <span>{upvotes}</span></button> : <span aria-label={`${upvotes} lượt ủng hộ`}>↑ {upvotes}</span>}{user ? <button type="button" aria-label="Không ủng hộ" aria-pressed={vote === -1} disabled={voteBusy} onClick={() => onVote(-1)}>↓ <span>{downvotes}</span></button> : <span aria-label={`${downvotes} lượt không ủng hộ`}>↓ {downvotes}</span>}{user && canReply && <button type="button" onClick={onReply}>Trả lời</button>}{user && menuItems.length > 0 && <div className="movie-comment-menu" ref={menuRef}><button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>••• Thêm</button>{open && <div className="movie-comment-menu-list">{menuItems.map((item) => <button type="button" key={item.label} onClick={() => { setOpen(false); item.action(); }}>{item.label}</button>)}</div>}</div>}{children}</div>;
}
