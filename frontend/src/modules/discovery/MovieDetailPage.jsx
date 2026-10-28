import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const MovieDetailPage = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [products, setProducts] = useState([]);
  const [comments, setComments] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [comment, setComment] = useState("");
  const [score, setScore] = useState(5);
  const [message, setMessage] = useState("");

  const reloadCommunity = useCallback(() => Promise.all([
    apiRequest(`/api/v1/productions/${id}/comments`).then((data) => setComments(data.items)),
    apiRequest(`/api/v1/productions/${id}/ratings`).then((data) => setRatings(data.items)),
  ]), [id]);
  useEffect(() => {
    apiRequest(`/api/v1/productions/${id}`).then(setMovie).catch((e) => setMessage(e.message));
    apiRequest(`/api/v1/shopping/productions/${id}/products`).then((data) => setProducts(data.items)).catch(() => {});
    reloadCommunity().catch((e) => setMessage(e.message));
  }, [id, reloadCommunity]);
  const action = async (path, method, body) => {
    setMessage("");
    try { await apiRequest(path, { method, body: body ? JSON.stringify(body) : undefined }); setMessage("Đã cập nhật thành công."); }
    catch (error) { setMessage(error.status === 503 ? "Chức năng này hoạt động sau khi merge module đăng nhập từ branch Du." : error.message); }
  };
  if (!movie) return <main className="page-shell"><p className="empty">{message || "Đang tải..."}</p></main>;
  return <main className="page-shell detail-page">
    <section className="detail-hero">
      <div className="detail-poster"><span>{movie.title.slice(0, 1)}</span></div>
      <div><p className="eyebrow">{movie.type} · {movie.status}</p><h1>{movie.title}</h1><p>{movie.description}</p><p>{movie.release_year} · {movie.country} · {movie.language} · ⭐ {Number(movie.rating_avg).toFixed(1)} ({movie.rating_count})</p><div className="chips">{movie.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>
        <div className="actions"><button onClick={() => action(`/api/v1/favorites/${id}`, "PUT")}>♥ Yêu thích</button><button className="secondary" onClick={() => action(`/api/v1/interests/${id}`, "PUT")}>🔔 Quan tâm</button></div>
        {message && <p className="status-message">{message}</p>}
      </div>
    </section>
    {products.length > 0 && (
      <section>
        <div className="section-title"><h2>🛒 Sản phẩm trong phim</h2><span>bấm để mở Shopee</span></div>
        <div className="chips" style={{ gap: ".6rem" }}>
          {products.map((item) => (
            <a key={item.id} className="button-link" style={{ textDecoration: "none", fontSize: ".8rem", padding: ".5rem .8rem", display: "inline-block" }} href={item.shopeeUrl} target="_blank" rel="noopener noreferrer">
              {item.productName} ↗
            </a>
          ))}
        </div>
      </section>
    )}
    <section><div className="section-title"><h2>Tập phim</h2></div><div className="episode-list">{movie.episodes.map((episode) => <Link key={episode.id} to={episode.season_number ? `/watch/${movie.slug}?ss=${episode.season_number}&ep=${episode.episode_in_season ?? episode.episode_number}` : `/watch/${movie.slug}?ep=${episode.episode_number}`}><strong>Tập {episode.episode_number}</strong><span>{episode.title}</span><small>{Math.ceil(episode.duration / 60)} phút</small></Link>)}</div></section>
    <div className="community-grid">
      <section className="panel"><h2>Đánh giá</h2><form onSubmit={async (e) => { e.preventDefault(); await action(`/api/v1/productions/${id}/rating`, "PUT", { rating: Number(score) }); reloadCommunity(); }}><label>Điểm của bạn <select value={score} onChange={(e) => setScore(e.target.value)}>{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} sao</option>)}</select></label><button>Gửi đánh giá</button></form><div className="feed">{ratings.map((item) => <article key={item.user_id}><b>{item.username}</b><span>{"★".repeat(item.rating)}</span>{item.review_content && <p>{item.review_content}</p>}</article>)}</div></section>
      <section className="panel"><h2>Bình luận</h2><form onSubmit={async (e) => { e.preventDefault(); if (!comment.trim()) return; await action(`/api/v1/productions/${id}/comments`, "POST", { content: comment }); setComment(""); reloadCommunity(); }}><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Viết bình luận..." maxLength={3000} /><button>Đăng bình luận</button></form><div className="feed">{comments.map((item) => <article key={item.id}><b>{item.username}</b><small>{new Date(item.created_at).toLocaleString("vi-VN")}</small><p>{item.content}</p></article>)}</div></section>
    </div>
  </main>;
};

export default MovieDetailPage;
