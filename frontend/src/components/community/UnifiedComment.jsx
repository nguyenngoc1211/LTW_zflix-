import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import UserAvatar from '../UserAvatar.jsx';
import MentionTextarea from './MentionTextarea.jsx';
import VipIdentity from '../VipIdentity.jsx';
import { vipAvatarClass } from '../vipIdentity.js';
import { API_URL } from '../../services/api.js';
import { ContentImages } from './ContentImages.jsx';

export function CommentFrame({ avatar, username, vipExpiresAt, date, profileId, children }) {
  const time = new Date(date);
  const profileUrl = Number.isSafeInteger(Number(profileId)) && Number(profileId) > 0 ? `/community/users/${profileId}` : null;
  const avatarNode = <UserAvatar src={avatar} className={`movie-comment-avatar ${vipAvatarClass(vipExpiresAt)}`} />;
  const nameNode = <VipIdentity username={username} vipExpiresAt={vipExpiresAt} />;
  return <article className="movie-comment">{profileUrl ? <Link className="movie-comment-profile-avatar" to={profileUrl} aria-label={`Xem hồ sơ ${username}`}>{avatarNode}</Link> : avatarNode}<div className="movie-comment-main"><div className="movie-comment-meta">{profileUrl ? <Link className="movie-comment-profile-name" to={profileUrl}>{nameNode}</Link> : nameNode}{!Number.isNaN(time.getTime()) && <time dateTime={time.toISOString()}>{time.toLocaleString('vi-VN')}</time>}</div>{children}</div></article>;
}

export function SpoilerContent({ spoiler, children }) {
  const [revealed, setRevealed] = useState(false);
  if (!spoiler) return children;
  return <>{revealed && children}<div className="movie-comment-actions"><button type="button" onClick={() => setRevealed(!revealed)}>{revealed ? 'Ẩn nội dung spoiler' : 'Hiện nội dung spoiler'}</button></div></>;
}

export function CommentMedia({ urls = [] }) {
  return <ContentImages urls={urls} variant="comment" />;
}

export function CommentForm({ onSubmit, text, onText, spoiler, onSpoiler, busy, onCancel, label = 'Viết bình luận...', imageFile, onImageFile, existingImageUrl, onRemoveExisting }) {
  const [preview, setPreview] = useState('');
  const [imageError, setImageError] = useState('');
  useEffect(() => {
    let url = '';
    const timer = setTimeout(() => { url = imageFile ? URL.createObjectURL(imageFile) : ''; setPreview(url); }, 0);
    return () => { clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [imageFile]);
  const choose = (file) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setImageError('Chỉ nhận PNG, JPEG hoặc WebP tối đa 5 MB.'); return; }
    setImageError(''); onImageFile?.(file);
  };
  return <form className="movie-reply-form unified-comment-form" onSubmit={onSubmit}><label>{label}<MentionTextarea value={text} onChange={onText} maxLength={3000} rows={text || imageFile ? 3 : 1} onPaste={(event) => { const file = [...event.clipboardData.files].find((item) => item.type.startsWith('image/')); if (file && onImageFile) { event.preventDefault(); choose(file); } }} /></label>{onImageFile && <><label className="unified-comment-upload">▧ Chọn ảnh<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }} /></label>{(preview || existingImageUrl) && <div className="unified-comment-preview"><img src={preview || (existingImageUrl?.startsWith('/') ? `${API_URL}${existingImageUrl}` : existingImageUrl)} alt="Ảnh bình luận sẽ gửi" /><button type="button" onClick={() => preview ? onImageFile(null) : onRemoveExisting?.()}>Xóa ảnh</button></div>}{imageError && <p role="alert" className="text-red-300 text-xs">{imageError}</p>}</>}{onSpoiler && <label className="movie-spoiler-option"><input type="checkbox" checked={spoiler} onChange={(event) => onSpoiler(event.target.checked)} /> Nội dung có spoiler</label>}<div className="movie-comment-actions"><button type="submit" disabled={busy || (!text.trim() && !imageFile && !existingImageUrl)}>{busy ? 'Đang gửi...' : 'Gửi'}</button>{onCancel && <button type="button" onClick={onCancel}>Hủy</button>}</div></form>;
}

export function CommentPagination({ page, more, loading = false, onPage }) {
  return <nav className="comment-pagination" aria-label="Phân trang bình luận"><button type="button" disabled={loading || page === 1} onClick={() => onPage(page - 1)}>‹ Trước</button><span aria-current="page">{page}</span><button type="button" disabled={loading || !more} onClick={() => onPage(page + 1)}>Sau ›</button></nav>;
}

export function ActionMenu({ items, label = 'Thao tác nội dung' }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const toggle = () => {
    if (!open) {
      const box = buttonRef.current.getBoundingClientRect();
      const height = Math.min(window.innerHeight - 16, items.length * 39 + 12);
      setPosition({ top: box.bottom + height + 8 > window.innerHeight ? Math.max(8, box.top - height - 6) : box.bottom + 6, right: Math.max(8, window.innerWidth - box.right) });
    }
    setOpen(!open);
  };
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!buttonRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    const resize = () => setOpen(false);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', resize); };
  }, [open]);
  if (!items.length) return null;
  return <><button ref={buttonRef} type="button" className="community-action-trigger" aria-label={label} aria-expanded={open} onClick={toggle}>···</button>{open && createPortal(<div ref={listRef} className="community-action-list" role="menu" style={position}>{items.map((item) => <button type="button" role="menuitem" key={item.label} onClick={() => { setOpen(false); item.action(); }}>{item.label}</button>)}</div>, document.body)}</>;
}

export function CommentActions({ user, upvotes = 0, downvotes = 0, vote, onVote, voteBusy = false, onReply, canReply, menuItems = [], children }) {
  return <div className="movie-comment-actions">{user ? <button type="button" aria-label="Ủng hộ" aria-pressed={vote === 1} disabled={voteBusy} onClick={() => onVote(1)}>↑ <span>{upvotes}</span></button> : <span aria-label={`${upvotes} lượt ủng hộ`}>↑ {upvotes}</span>}{user ? <button type="button" aria-label="Không ủng hộ" aria-pressed={vote === -1} disabled={voteBusy} onClick={() => onVote(-1)}>↓ <span>{downvotes}</span></button> : <span aria-label={`${downvotes} lượt không ủng hộ`}>↓ {downvotes}</span>}{user && canReply && <button type="button" onClick={onReply}>Trả lời</button>}{user && menuItems.length > 0 && <ActionMenu items={menuItems} label="Thao tác bình luận" />}{children}</div>;
}
