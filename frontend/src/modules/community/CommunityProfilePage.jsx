import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCamera, FiEdit3, FiUserCheck, FiUserPlus } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth.js';
import { apiRequest } from '../../services/api.js';
import UserAvatar from '../../components/UserAvatar.jsx';
import { PostCard } from './CommunityPage.jsx';
import './community-profile.css';

const tabs = [['posts', 'Bài viết'], ['reviews', 'Review'], ['comments', 'Bình luận'], ['liked', 'Bài đã thích']];
export default function CommunityProfilePage() {
  const { id } = useParams();
  const { user, updateAvatar } = useAuth();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('posts');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [list, setList] = useState('');
  const [listItems, setListItems] = useState([]);
  const [listPage, setListPage] = useState(1);
  const [listMore, setListMore] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const loadProfile = useCallback(async () => {
    try { const result = await apiRequest(`/api/v1/community/users/${id}`); setProfile(result); setBio(result.bio || ''); setDisplayName(result.display_name || ''); setError(''); }
    catch (err) { setError(err.message); setProfile(null); }
  }, [id]);
  useEffect(() => { loadProfile(); }, [loadProfile, user?.id]);
  useEffect(() => {
    let active = true; setLoading(true);
    apiRequest(`/api/v1/community/users/${id}/activity?tab=${tab}&page=${page}`).then((result) => { if (active) { setItems(result.items || []); setHasMore(result.hasMore); setError(''); } }).catch((err) => { if (active) { setItems([]); setError(err.message); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, tab, page, user?.id]);
  useEffect(() => {
    if (!list) return;
    let active = true;
    apiRequest(`/api/v1/community/users/${id}/${list}?page=${listPage}`).then((result) => { if (active) { setListItems(result.items || []); setListMore(result.hasMore); } }).catch((err) => { if (active) setMessage(err.message); });
    return () => { active = false; };
  }, [id, list, listPage]);
  const follow = async () => {
    if (!user) { setMessage('Vui lòng đăng nhập để theo dõi.'); return; }
    if (busy) return;
    setBusy(true); setMessage('');
    try { const result = await apiRequest(`/api/v1/community/users/${id}/follow`, { method: profile.isFollowing ? 'DELETE' : 'PUT' }); setProfile((current) => ({ ...current, isFollowing: result.isFollowing, counts: { ...current.counts, followers: result.followers } })); }
    catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };
  const saveProfile = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const result = await apiRequest('/api/v1/community/users/me', { method: 'PATCH', body: JSON.stringify({ bio, displayName }) }); setProfile((current) => ({ ...current, ...result })); setEditing(false); setMessage('Đã cập nhật hồ sơ.'); }
    catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };
  const avatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage('Chọn ảnh JPG, PNG hoặc WebP dưới 5 MB.'); return; }
    setBusy(true); setMessage('');
    try { const result = await updateAvatar(file); setProfile((current) => ({ ...current, avatar_url: result.avatarUrl })); setMessage('Đã cập nhật ảnh đại diện.'); }
    catch (err) { setMessage(err.message); }
    finally { setBusy(false); event.target.value = ''; }
  };
  const remove = async (postId) => {
    try { await apiRequest(`/api/v1/community/posts/${postId}`, { method: 'DELETE' }); setItems((current) => current.filter((post) => post.id !== postId)); loadProfile(); }
    catch (err) { setMessage(err.message); }
  };
  const changeTab = (next) => { setTab(next); setPage(1); };
  const showList = (next) => { setList(next); setListPage(1); };
  return <main className="community-profile-page"><div className="community-profile-wrap"><Link className="community-profile-back" to="/community"><FiArrowLeft /> Bảng tin</Link>{error && <p role="alert" className="community-profile-message">{error}</p>}{profile && <>
    <section className="community-profile-hero"><div className="community-profile-banner" /><div className="community-profile-header"><div className="community-profile-avatar-wrap"><UserAvatar src={profile.avatar_url} className="community-profile-avatar" />{profile.isSelf && <label className="community-profile-camera" title="Đổi ảnh đại diện"><FiCamera /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={avatar} disabled={busy} /></label>}</div><div className="community-profile-identity"><h1>{profile.display_name || profile.username}</h1><p>@{profile.username}</p><small>Tham gia {profile.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'ZFLIX'}</small></div>{profile.isSelf ? <button type="button" className="community-profile-follow muted" onClick={() => setEditing(!editing)}><FiEdit3 /> Chỉnh sửa</button> : <button type="button" className={`community-profile-follow ${profile.isFollowing ? 'muted' : ''}`} onClick={follow} disabled={busy || !profile.canFollow}>{profile.isFollowing ? <FiUserCheck /> : <FiUserPlus />}{profile.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}</button>}</div><p className="community-profile-bio">{profile.bio || (profile.isSelf ? 'Thêm vài dòng giới thiệu về bạn.' : 'Chưa có giới thiệu.')}</p><div className="community-profile-stats"><span><strong>{profile.counts.posts}</strong>Bài viết</span><button type="button" onClick={() => showList('followers')}><strong>{profile.counts.followers}</strong>Người theo dõi</button><button type="button" onClick={() => showList('following')}><strong>{profile.counts.following}</strong>Đang theo dõi</button></div></section>
    {editing && profile.isSelf && <form className="community-profile-edit" onSubmit={saveProfile}><label>Tên hiển thị<input maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Giới thiệu<textarea maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} /></label><div><button disabled={busy}>Lưu hồ sơ</button><button type="button" onClick={() => setEditing(false)}>Hủy</button></div></form>}
    {message && <p role="status" className="community-profile-message">{message}</p>}
    {list && <section className="community-profile-list"><div><h2>{list === 'followers' ? 'Người theo dõi' : 'Đang theo dõi'}</h2><button type="button" onClick={() => setList('')}>Đóng</button></div>{listItems.length ? listItems.map((entry) => <Link key={entry.id} to={`/community/users/${entry.id}`} onClick={() => setList('')}><UserAvatar src={entry.avatar_url} className="community-profile-list-avatar" /><span>{entry.display_name || entry.username}<small>@{entry.username}</small></span></Link>) : <p>Chưa có người dùng nào.</p>}<div className="community-profile-pages"><button disabled={listPage === 1} onClick={() => setListPage(listPage - 1)}>Trước</button><span>{listPage}</span><button disabled={!listMore} onClick={() => setListPage(listPage + 1)}>Sau</button></div></section>}
    <div className="community-profile-tabs" role="group" aria-label="Hoạt động">{tabs.filter(([value]) => value !== 'liked' || profile.isSelf).map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => changeTab(value)}>{label}</button>)}</div>
    {loading ? <p className="community-profile-empty">Đang tải...</p> : items.length ? <div className="community-profile-items">{tab === 'comments' ? items.map((item) => <article key={item.id} className="community-profile-comment"><Link to={`/community/posts/${item.post_id}`}>{item.post_title}</Link><p>{item.content}</p><time>{new Date(item.created_at).toLocaleString('vi-VN')}</time></article>) : items.map((post) => <PostCard key={`${post.id}:${user?.id || 'guest'}`} post={post} user={user} onDelete={remove} onUpdated={(updated) => setItems((current) => current.map((item) => item.id === updated.id ? updated : item))} />)}</div> : <p className="community-profile-empty">Chưa có hoạt động trong mục này.</p>}
    <div className="community-profile-pages"><button disabled={page === 1} onClick={() => setPage(page - 1)}>← Trước</button><span>Trang {page}</span><button disabled={!hasMore} onClick={() => setPage(page + 1)}>Sau →</button></div>
  </>}</div></main>;
}
