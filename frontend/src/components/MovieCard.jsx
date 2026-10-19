import { Link } from "react-router-dom";

const MovieCard = ({ movie }) => (
  <article className="movie-card">
    <Link to={`/movies/${movie.id}`} className="poster-wrap">
      {movie.poster_url && <img src={movie.poster_url} alt={movie.title} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
      <span className="poster-fallback">{movie.title?.slice(0, 1)}</span>
      {movie.is_premium ? <span className="premium">VIP</span> : null}
    </Link>
    <div className="movie-info">
      <Link to={`/movies/${movie.id}`}><h3>{movie.title}</h3></Link>
      <p>{movie.release_year || "—"} · ⭐ {Number(movie.rating_avg || 0).toFixed(1)}</p>
      <div className="chips">{(movie.genres || []).slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)}</div>
    </div>
  </article>
);

export default MovieCard;
