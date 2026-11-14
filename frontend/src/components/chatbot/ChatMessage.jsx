import { Link } from "react-router-dom";
import { FiAlertCircle, FiRotateCcw } from "react-icons/fi";
import SafeMarkdown from "./SafeMarkdown.jsx";
import ChatMovieCard from "./ChatMovieCard.jsx";

export default function ChatMessage({ message, onRetry }) {
  const user = message.role === "user";
  return <article className={`zflix-chat-row ${user ? "is-user" : "is-assistant"}`}>
    {!user && <span className="zflix-chat-avatar" aria-hidden="true">Z</span>}
    <div className="zflix-chat-row-content">
      <span className="zflix-chat-author">{user ? "Bạn" : "Zflix AI"}</span>
      <div className={`zflix-chat-bubble ${message.error ? "is-error" : ""}`}>
        {message.pending ? <span className="zflix-chat-typing" role="status" aria-label="Zflix AI đang trả lời"><i /><i /><i /></span>
          : message.error ? <div className="zflix-chat-error"><FiAlertCircle aria-hidden="true" /><span>{message.error}</span></div>
            : user ? <p>{message.text}</p> : <SafeMarkdown text={message.text} />}
      </div>
      {message.error && <button type="button" className="zflix-chat-retry" onClick={onRetry}><FiRotateCcw aria-hidden="true" /> Thử lại</button>}
      {message.movies?.length > 0 && <div className="zflix-chat-movie-list">{message.movies.map((movie) => <ChatMovieCard key={movie.id} movie={movie} />)}</div>}
      {message.sources?.length > 0 && <div className="zflix-chat-source-list">
        <span>Phim liên quan</span>
        {message.sources.map((id) => <Link key={id} to={`/movies/${id}`}>Phim #{id}</Link>)}
      </div>}
    </div>
  </article>;
}
