import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.js';
import { PostCard } from '../../modules/community/CommunityPage.jsx';
import ToxicComment from '../community/ToxicComment.jsx';
import { mergeDiscussion } from '../../utils/streaming/discussionFeed.js';
import UserAvatar from '../UserAvatar.jsx';

export default function AllDiscussion({ productionId, episodeId, allEpisodes, version }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [comments, setComments] = useState([]);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const loadComments = async () => {
          const items = [];
          let commentPage = 1;
          let hasMore = true;
          while (hasMore && items.length <= page * 12) {
            const result = await apiRequest(`/api/v1/productions/${productionId}/comments?page=${commentPage++}&limit=50`);
            items.push(...result.items);
            hasMore = result.hasMore;
          }
          return items;
        };
        const query = new URLSearchParams({ type: 'screenshot', onMoviePage: 'true', movieId: String(productionId), limit: '50' });
        if (!allEpisodes && episodeId) query.set('episodeId', String(episodeId));
        const loadPosts = async () => {
          const items = [];
          let postPage = 1;
          let hasMore = true;
          while (hasMore && items.length <= page * 12) {
            query.set('page', String(postPage++));
            const result = await apiRequest(`/api/v1/community/posts?${query}`);
            items.push(...result.items);
            hasMore = result.hasMore;
          }
          return items;
        };
        const [commentResult, postResult] = await Promise.all([loadComments(), loadPosts()]);
        if (active) { setComments(commentResult); setPosts(postResult); setError(''); }
      } catch (err) { if (active) setError(err.message); }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [productionId, episodeId, allEpisodes, page, version]);
  const remove = async (id) => {
    try { await apiRequest(`/api/v1/community/posts/${id}`, { method: 'DELETE' }); setPosts((items) => items.filter((item) => item.id !== id)); }
    catch (err) { setError(err.message); }
  };
  const update = (post) => setPosts((items) => items.map((item) => item.id === post.id ? post : item));
  const merged = mergeDiscussion(comments, posts, page);
  return <div className="space-y-4">
    <p className="text-sm text-zinc-400">Bình luận thuộc toàn bộ phim; khoảnh khắc được lọc theo lựa chọn tập.</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {loading ? <p>Đang tải thảo luận...</p> : !merged.items.length && !error ? <p>Chưa có thảo luận.</p> : merged.items.map(({ type, item }) => type === 'post'
      ? <PostCard key={`post:${item.id}`} post={item} user={user} onDelete={remove} onUpdated={update} />
      : <article key={`comment:${item.id}`} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><UserAvatar src={item.avatar_url} className="h-7 w-7 rounded-full object-cover" />{item.username} · {new Date(item.created_at).toLocaleString('vi-VN')} · Bình luận phim</div><ToxicComment content={item.content} isToxic={Boolean(Number(item.is_toxic))} className="mt-2 whitespace-pre-wrap break-words" /></article>)}
    <div className="flex gap-3"><button disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Trước</button><span>{page}</span><button disabled={loading || !merged.hasMore} onClick={() => setPage(page + 1)}>Sau</button></div>
  </div>;
}
