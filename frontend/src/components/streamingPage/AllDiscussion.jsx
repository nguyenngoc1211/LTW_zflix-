import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../hooks/useAuth.js';
import { PostCard } from '../../modules/community/CommunityPage.jsx';
import { CommentPagination } from '../community/UnifiedComment.jsx';
import MovieCommentItem from './MovieCommentItem.jsx';

function DiscussionList({ productionId, version, scene }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const url = scene ? `/api/v1/scene-questions?movieId=${productionId}&page=${page}&limit=12` : `/api/v1/productions/${productionId}/comments?parentId=root&page=${page}&limit=12`;
    apiRequest(url).then((data) => { if (active) { setItems(data.items); setMore(data.hasMore); setError(''); } }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productionId, page, scene, version, user?.id]);
  const remove = async (id) => {
    try { await apiRequest(`/api/v1/scene-questions/${id}`, { method: 'DELETE' }); setItems((current) => current.filter((item) => item.id !== id)); }
    catch (err) { setError(err.message); }
  };
  const update = (post) => setItems((current) => current.map((item) => item.id === post.id ? post : item));
  return <section className="space-y-4">{scene && <h3 className="text-pink-500 font-bold text-lg">Hỏi đáp khoảnh khắc</h3>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {loading ? <p>Đang tải...</p> : !items.length && !error ? <p>Chưa có {scene ? 'câu hỏi' : 'bình luận'}.</p> : items.map((item) => scene ? <PostCard key={`${item.id}:${user?.id ?? 'guest'}`} post={item} user={user} onDelete={remove} onUpdated={update} compact /> : <MovieCommentItem key={`${item.id}:${user?.id ?? 'guest'}`} comment={item} productionId={productionId} />)}
    {(page > 1 || more) && <CommentPagination page={page} more={more} onPage={setPage} />}
  </section>;
}

export default function AllDiscussion({ productionId, version, scene = false }) {
  return <DiscussionList productionId={productionId} version={version} scene={scene} />;
}
