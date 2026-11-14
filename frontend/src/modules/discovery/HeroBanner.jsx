import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const HeroBanner = ({ movies }) => {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(media.matches);
    document.addEventListener("visibilitychange", onVisibility);
    media.addEventListener("change", onMotion);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", onMotion);
    };
  }, []);

  useEffect(() => {
    if (movies.length < 2 || hovered || !visible || reducedMotion) return undefined;
    const timer = window.setTimeout(() => setCurrent((index) => (index + 1) % movies.length), 6000);
    return () => window.clearTimeout(timer);
  }, [current, hovered, visible, reducedMotion, revision, movies.length]);

  const select = (index) => {
    setCurrent((index + movies.length) % movies.length);
    setRevision((value) => value + 1);
  };

  if (!movies.length) return (
    <section className="hero hero-empty"><div className="hero-inner">
      <p className="eyebrow">ZFLIX</p><h1>Phim hay cho mọi khoảnh khắc.</h1>
      <p>Khám phá kho phim và chọn bộ phim bạn yêu thích.</p>
    </div></section>
  );

  return <section className="hero hero-carousel" aria-label="Top phim hot" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    {movies.map((movie, index) => <div key={movie.id} className={`hero-slide${index === current ? " is-active" : ""}`} aria-hidden={index !== current}>
      <div className="hero-backdrop">{(movie.banner_url || movie.poster_url) && <img src={movie.banner_url || movie.poster_url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</div>
      <div className="hero-inner"><div className="hero-copy">
        <p className="eyebrow">ZFLIX <span>·</span> TOP {index + 1} PHIM HOT</p>
        {movie.title_logo_url ? <img className="hero-title-art" src={movie.title_logo_url} alt={movie.title} /> : <h1>{movie.title}</h1>}
        {movie.original_title && movie.original_title !== movie.title && <p className="hero-original-title">{movie.original_title}</p>}
        <div className="hero-meta">
          {Number(movie.imdb_rating) > 0 && <span className="hero-imdb">IMDb {Number(movie.imdb_rating).toFixed(1)}</span>}
          {Number(movie.rating_avg) > 0 && <span className="hero-score">★ {Number(movie.rating_avg).toFixed(1)}/5</span>}
          {movie.release_year && <span>{movie.release_year}</span>}
          {movie.age_rating && <span>{movie.age_rating}</span>}
          {movie.type === "series" && Number(movie.season_count) > 0 && <span>{movie.season_count} phần</span>}
          {movie.type === "series" && Number(movie.episode_count) > 0 && <span>{movie.episode_count} tập</span>}
          {movie.type === "movie" && <span>Phim lẻ</span>}
        </div>
        {!!movie.genres?.length && <div className="hero-genres">{movie.genres.slice(0, 3).map((genre) => <span key={genre}>{genre}</span>)}</div>}
        <p className="hero-description">{movie.description || "Khám phá bộ phim trên ZFLIX."}</p>
        <div className="actions"><Link className="button-link hero-play" to={`/movies/${movie.id}`} tabIndex={index === current ? 0 : -1}><span aria-hidden="true">▶</span> Xem ngay</Link></div>
      </div></div>
    </div>)}
    {movies.length > 1 && <div className="hero-thumbnails" aria-label="Chọn phim trong TOP 5">
      {movies.map((movie, index) => <button key={movie.id} type="button" className={`hero-thumbnail${index === current ? " is-active" : ""}`} onClick={() => select(index)} aria-label={`TOP ${index + 1}: ${movie.title}`} aria-current={index === current ? "true" : undefined} title={movie.title}>
        <span className="hero-thumb-fallback">{movie.title}</span>
        {(movie.banner_url || movie.poster_url) && <img src={movie.banner_url || movie.poster_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
        <span className="hero-thumb-rank">{index + 1}</span>
      </button>)}
    </div>}
  </section>;
};

export default HeroBanner;
