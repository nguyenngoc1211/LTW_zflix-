import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const PlayerPage = () => {
  const { episodeId } = useParams();
  const [episode, setEpisode] = useState(null);
  const [position, setPosition] = useState(0);
  const lastSaved = useRef(0);
  useEffect(() => { apiRequest(`/api/v1/episodes/${episodeId}`).then(setEpisode); }, [episodeId]);
  const save = (seconds) => {
    if (Math.abs(seconds - lastSaved.current) < 10) return;
    lastSaved.current = seconds;
    apiRequest(`/api/v1/history/${episodeId}`, { method: "PUT", body: JSON.stringify({ position: seconds }) }).catch(() => {});
  };
  if (!episode) return <main className="page-shell"><p className="empty">Đang tải tập phim...</p></main>;
  return <main className="page-shell player-page"><Link to={`/movies/${episode.production_id}`}>← {episode.production_title}</Link><h1>Tập {episode.episode_number}: {episode.title}</h1>{episode.video_url ? <video controls autoPlay src={episode.video_url} onTimeUpdate={(e) => { setPosition(e.currentTarget.currentTime); save(Math.floor(e.currentTarget.currentTime)); }} onPause={(e) => save(Math.floor(e.currentTarget.currentTime))} /> : <div className="video-placeholder"><span>▶</span><p>Chưa có URL video trong dữ liệu mẫu.</p></div>}<div className="manual-progress"><label>Vị trí xem thử: {position} giây</label><input type="range" min="0" max={episode.duration} value={position} onChange={(e) => setPosition(Number(e.target.value))} /><button onClick={() => save(position)}>Lưu vị trí xem</button></div></main>;
};
export default PlayerPage;
