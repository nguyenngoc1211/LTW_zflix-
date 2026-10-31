import { Link } from "react-router-dom";

const formatProgress = (item) => Math.min(100, Math.max(0, Number(item.watched_percent) || 0));

const ContinueWatchingRail = ({ items }) => {
  if (!items.length) return null;

  return (
    <section className="continue-watching" aria-labelledby="continue-watching-title">
      <div className="section-title">
        <h2 id="continue-watching-title">Xem tiếp</h2>
        <span>{items.length} phim đang xem dở</span>
      </div>
      <div className="continue-watching-track">
        {items.map((item) => {
          const progress = formatProgress(item);
          const resumeAt = Math.max(0, Math.floor(Number(item.last_position) || 0));
          return (
            <Link
              key={item.production_id}
              className="continue-card"
              to={`/watch-episode/${item.episode_id}?pos=${resumeAt}`}
            >
              <div className="continue-card-poster">
                {item.poster_url ? (
                  <img src={item.poster_url} alt="" loading="lazy" />
                ) : (
                  <span>{item.title?.slice(0, 1)}</span>
                )}
                <span className="continue-card-play" aria-hidden="true">▶</span>
                <span className="continue-card-progress" style={{ width: `${progress}%` }} />
              </div>
              <div className="continue-card-info">
                <strong>{item.title}</strong>
                <span>Tập {item.episode_number}: {item.episode_title}</span>
                <small>Đã xem {Math.round(progress)}% · tiếp tục từ {Math.floor(resumeAt / 60)} phút</small>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ContinueWatchingRail;
