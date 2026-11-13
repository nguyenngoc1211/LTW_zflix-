import { Link } from "react-router-dom";
import { FiArrowUpRight, FiFilm, FiStar } from "react-icons/fi";

export default function ChatMovieCard({ movie }) {
  return <article className="zflix-chat-movie">
    <Link className="zflix-chat-movie-poster" to={`/movies/${movie.id}`} aria-label={`Xem ${movie.title}`}>
      {movie.poster ? <img src={movie.poster} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
      <FiFilm aria-hidden="true" />
    </Link>
    <div className="zflix-chat-movie-info">
      <strong>{movie.title}</strong>
      <div className="zflix-chat-movie-meta">
        {movie.year && <span>{movie.year}</span>}
        {movie.rating !== null && <span><FiStar aria-hidden="true" /> {movie.rating.toFixed(1)}</span>}
      </div>
      {movie.genres.length > 0 && <div className="zflix-chat-movie-genres">{movie.genres.slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)}</div>}
      {movie.description && <p>{movie.description}</p>}
      <Link className="zflix-chat-movie-watch" to={`/movies/${movie.id}`}>Xem phim <FiArrowUpRight aria-hidden="true" /></Link>
    </div>
  </article>;
}
