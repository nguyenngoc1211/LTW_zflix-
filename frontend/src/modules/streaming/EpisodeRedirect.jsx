import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../services/api.js';
import { createEpisodeWatchUrl, parseWatchPosition } from '../../utils/streaming/watchUrl.js';

export default function EpisodeRedirect() {
  const { episodeId } = useParams();
  const [params] = useSearchParams();
  const requestKey = `${episodeId}?${params.toString()}`;
  const [result, setResult] = useState({ key: '', url: null, error: '' });
  useEffect(() => {
    let active = true;
    if (!/^[1-9]\d*$/.test(episodeId)) {
      return () => { active = false; };
    }
    apiRequest(`/api/v1/episodes/${episodeId}`).then((episode) => {
      const url = createEpisodeWatchUrl(episode, parseWatchPosition(params.get('pos')));
      if (active) setResult(url ? { key: requestKey, url, error: '' } : { key: requestKey, url: null, error: 'Không thể xác định phim và tập tương ứng.' });
    }).catch(() => { if (active) setResult({ key: requestKey, url: null, error: 'Không tìm thấy tập phim hoặc không thể tải dữ liệu.' }); });
    return () => { active = false; };
  }, [episodeId, params, requestKey]);
  if (!/^[1-9]\d*$/.test(episodeId)) return <main className="page-shell">Mã tập phim không hợp lệ. <Link to="/">Về trang chủ</Link></main>;
  if (result.key !== requestKey) return <main className="page-shell">Đang tải tập phim...</main>;
  if (result.error) return <main className="page-shell">{result.error} <Link to="/">Về trang chủ</Link></main>;
  return result.url ? <Navigate replace to={result.url} /> : <main className="page-shell">Đang tải tập phim...</main>;
}
