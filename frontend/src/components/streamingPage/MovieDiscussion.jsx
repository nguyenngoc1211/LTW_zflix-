import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.js';
import { PostCard } from '../../modules/community/CommunityPage.jsx';
import CommentSection from './CommentSection.jsx';

export default function MovieDiscussion({ productionId, episodeId, version }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('comments');
  const [allEpisodes, setAllEpisodes] = useState(false);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (tab !== 'moments' || !productionId) return undefined;
    let active = true;
    apiRequest(`/api/v1/community/posts?type=screenshot&onMoviePage=true&movieId=${productionId}${!allEpisodes && episodeId ? `&episodeId=${episodeId}` : ''}&page=${page}`).then((data) => {
      if (active) { setPosts(data.items); setMore(data.hasMore); setError(''); }
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [tab, productionId, episodeId, allEpisodes, page, version]);
  const remove = async (id) => {
    try { await apiRequest(`/api/v1/community/posts/${id}`, { method: 'DELETE' }); setPosts((items) => items.filter((item) => item.id !== id)); }
    catch (err) { setError(err.message); }
  };
  return <div className="space-y-4"><div className="flex gap-4 border-b border-zinc-700"><button className={`p-2 ${tab === 'comments' ? 'text-pink-400' : ''}`} onClick={() => setTab('comments')}>Bình luận</button><button className={`p-2 ${tab === 'moments' ? 'text-pink-400' : ''}`} onClick={() => setTab('moments')}>Khoảnh khắc</button></div>{tab === 'comments' ? <CommentSection productionId={productionId} /> : <div className="space-y-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={allEpisodes} onChange={(e) => { setAllEpisodes(e.target.checked); setPage(1); }} />Tất cả tập</label>{error && <p role="alert">{error}</p>}{!posts.length && !error && <p>Chưa có khoảnh khắc.</p>}{posts.map((post) => <PostCard key={post.id} post={post} user={user} onDelete={remove} />)}<div className="flex gap-3"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button><span>{page}</span><button disabled={!more} onClick={() => setPage(page + 1)}>Sau</button></div></div>}</div>;
}
