import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiChevronDown, FiFilm, FiImage, FiPlus, FiSearch, FiX } from 'react-icons/fi';
import { apiRequest } from '../../services/api.js';
import MentionTextarea from '../../components/community/MentionTextarea.jsx';
import { commentRequestHeaders, clearCommentRequest } from '../../utils/commentRequest.js';
import './community-composer.css';

const kinds = [
  ['discussion', 'Thảo luận'], ['review', 'Review'], ['question', 'Hỏi đáp'],
  ['news', 'Tin tức'], ['meme', 'Meme'], ['poll', 'Poll'],
];
const maxFiles = 5;
const maxBytes = 5 * 1024 * 1024;

export default function CommunityComposer() {
  const navigate = useNavigate();
  const [kind, setKind] = useState('discussion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [options, setOptions] = useState(['', '']);
  const [movie, setMovie] = useState(null);
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState([]);
  const [movieOpen, setMovieOpen] = useState(false);
  const [movieLoading, setMovieLoading] = useState(false);
  const [movieError, setMovieError] = useState('');
  const [activeMovie, setActiveMovie] = useState(0);
  const [linkEpisode, setLinkEpisode] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [episodeId, setEpisodeId] = useState('');
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const fileInput = useRef(null);
  const pendingPost = useRef(null);
  const searchSeq = useRef(0);
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => {
    if (movie || movieQuery.trim().length < 2) { setMovieResults([]); setMovieLoading(false); return; }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setMovieLoading(true); setMovieError('');
      try {
        const result = await apiRequest(`/api/v1/community/posts/movie-options?search=${encodeURIComponent(movieQuery.trim())}`);
        if (seq === searchSeq.current) { setMovieResults(result.items || []); setActiveMovie(0); }
      } catch (err) { if (seq === searchSeq.current) { setMovieResults([]); setMovieError(err.message); } }
      finally { if (seq === searchSeq.current) setMovieLoading(false); }
    }, 280);
    return () => { clearTimeout(timer); searchSeq.current += 1; };
  }, [movie, movieQuery]);
  useEffect(() => {
    if (!movie || !linkEpisode) { setEpisodes([]); return; }
    let active = true;
    setEpisodeLoading(true);
    apiRequest(`/api/v1/productions/${movie.id}`).then((result) => { if (active) setEpisodes(result.episodes || []); }).catch((err) => { if (active) { setEpisodes([]); setError(`Không tải được danh sách tập: ${err.message}`); } }).finally(() => { if (active) setEpisodeLoading(false); });
    return () => { active = false; };
  }, [movie, linkEpisode]);

  const selectMovie = (item) => { setMovie(item); setMovieQuery(''); setMovieResults([]); setMovieOpen(false); setEpisodeId(''); setLinkEpisode(false); };
  const clearMovie = () => { setMovie(null); setMovieQuery(''); setEpisodeId(''); setLinkEpisode(false); };
  const onMovieKeyDown = (event) => {
    if (event.key === 'Escape') { setMovieOpen(false); return; }
    if (event.key === 'Enter') event.preventDefault();
    if (!movieOpen || !movieResults.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveMovie((index) => (index + 1) % movieResults.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveMovie((index) => (index - 1 + movieResults.length) % movieResults.length); }
    if (event.key === 'Enter') { event.preventDefault(); selectMovie(movieResults[activeMovie]); }
  };
  const addFiles = (incoming) => {
    const images = Array.from(incoming);
    if (images.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Chỉ nhận ảnh JPG, PNG hoặc WebP.'); return; }
    if (images.some((file) => file.size > maxBytes)) { setError('Mỗi ảnh phải nhỏ hơn 5 MB.'); return; }
    if (files.length + images.length > maxFiles) { setError('Chỉ được chọn tối đa 5 ảnh.'); return; }
    setFiles((current) => [...current, ...images]); setError('');
    if (fileInput.current) fileInput.current.value = '';
  };
  const submit = async (event) => {
    event.preventDefault();
    if (kind === 'review' && (!movie || !rating)) { setError('Review cần chọn phim và chấm điểm.'); return; }
    if (kind === 'poll' && (options.length < 2 || options.some((value) => !value.trim()))) { setError('Poll cần ít nhất hai lựa chọn.'); return; }
    setSending(true); setError('');
    try {
      const post = { title: title.trim(), content: content.trim(), isSpoiler: false, category: kind,
        ...(movie && { productionId: movie.id }), ...(episodeId && { episodeId: Number(episodeId) }),
        ...(kind === 'review' && { rating }),
        ...(kind === 'poll' && { pollOptions: options.map((value) => value.trim()) }),
      };
      const headers = commentRequestHeaders(pendingPost, JSON.stringify({ post, files: files.map((file) => [file.name, file.size, file.lastModified]) }));
      let result;
      if (files.length) {
        const form = new FormData(); form.append('post', JSON.stringify(post)); files.forEach((file) => form.append('images', file));
        result = await apiRequest('/api/v1/community/posts/with-images', { method: 'POST', headers, body: form });
      } else result = await apiRequest('/api/v1/community/posts', { method: 'POST', headers, body: JSON.stringify(post) });
      clearCommentRequest(pendingPost);
      navigate(`/community/posts/${result.id}`);
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  };

  return <form className="community-composer" onSubmit={submit}>
    <div className="composer-intro"><FiFilm /><span>Chia sẻ với cộng đồng ZFLIX</span></div>
    <div className="composer-kind" role="group" aria-label="Loại bài viết">{kinds.map(([value, label]) => <button type="button" key={value} aria-pressed={kind === value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>{label}</button>)}</div>
    <label className="composer-title"><span>Tiêu đề <b>*</b></span><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'review' ? 'Cảm nhận của bạn về bộ phim...' : kind === 'poll' ? 'Bạn muốn hỏi cộng đồng điều gì?' : 'Đặt một tiêu đề thú vị...'} /></label>
    <label className="composer-content"><span>Nội dung</span><MentionTextarea maxLength={10000} value={content} onChange={setContent} rows={6} placeholder="Viết điều bạn muốn chia sẻ..." /></label>
    <section className="composer-section"><div className="composer-section-heading"><FiFilm /><div><strong>{kind === 'review' ? 'Phim được review' : 'Liên kết phim'}</strong><small>{kind === 'review' ? 'Chọn phim để đăng review' : 'Tùy chọn · giúp mọi người tìm đúng phim'}</small></div></div>
      {movie ? <div className="composer-selected-movie">{movie.poster_url ? <img src={movie.poster_url} alt="" /> : <span className="composer-poster-fallback"><FiFilm /></span>}<div><strong>{movie.title}</strong><small>{movie.release_year || 'Chưa rõ năm'} · {movie.type === 'series' ? 'Phim bộ' : 'Phim lẻ'}</small></div><button type="button" onClick={clearMovie} aria-label="Bỏ chọn phim"><FiX /></button></div> : <div className="composer-movie-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMovieOpen(false); }}><div className="composer-search-input"><FiSearch /><input role="combobox" aria-label="Tìm phim" aria-expanded={movieOpen} aria-controls="composer-movie-results" aria-activedescendant={movieOpen && movieResults.length ? `composer-movie-${activeMovie}` : undefined} value={movieQuery} onChange={(event) => { setMovieQuery(event.target.value); setMovieOpen(true); }} onFocus={() => setMovieOpen(true)} onKeyDown={onMovieKeyDown} placeholder="Tìm theo tên phim..." autoComplete="off" />{movieLoading && <span className="composer-spinner" aria-label="Đang tìm phim" />}</div>{movieOpen && movieQuery.trim().length >= 2 && <div id="composer-movie-results" className="composer-movie-results" role="listbox">{movieError ? <p role="alert">{movieError}</p> : movieLoading ? <p>Đang tìm phim...</p> : movieResults.length ? movieResults.map((item, index) => <button type="button" role="option" aria-selected={activeMovie === index} id={`composer-movie-${index}`} key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMovie(item)}>{item.poster_url ? <img src={item.poster_url} alt="" /> : <span className="composer-poster-fallback"><FiFilm /></span>}<span><strong>{item.title}</strong><small>{item.release_year || 'Chưa rõ năm'} · {item.type === 'series' ? 'Phim bộ' : 'Phim lẻ'}</small></span>{activeMovie === index && <FiCheck />}</button>) : <p>Không tìm thấy phim phù hợp.</p>}</div>}</div>}
      {movie && <div className="composer-episode"><button type="button" className="composer-episode-toggle" aria-expanded={linkEpisode} onClick={() => { setLinkEpisode((value) => !value); setEpisodeId(''); }}><FiChevronDown /> Liên kết một tập cụ thể</button>{linkEpisode && <label><span>Chọn tập</span><select value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} disabled={episodeLoading || !episodes.length}><option value="">{episodeLoading ? 'Đang tải tập...' : episodes.length ? 'Không chọn tập' : 'Phim này chưa có tập'}</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.display_title || `Tập ${episode.episode_number} · ${episode.title}`}</option>)}</select></label>}</div>}
    </section>
    {kind === 'review' && <section className="composer-section"><div className="composer-section-heading"><span className="composer-star-icon">★</span><div><strong>Điểm đánh giá</strong><small>Chọn từ 0.5 đến 5 sao</small></div></div><div className="composer-stars" role="group" aria-label="Điểm đánh giá">{Array.from({ length: 10 }, (_, index) => { const value = (index + 1) / 2; return <button type="button" key={value} aria-label={`${value} sao`} aria-pressed={rating === value} className={rating >= value ? 'filled' : ''} onClick={() => setRating(value)}>★</button>; })}<span>{rating ? `${rating.toFixed(1)}/5` : 'Chưa chấm'}</span></div></section>}
    {kind === 'poll' && <section className="composer-section"><div className="composer-section-heading"><FiPlus /><div><strong>Lựa chọn bình chọn</strong><small>Ít nhất 2, tối đa 10 lựa chọn</small></div></div><div className="composer-options">{options.map((value, index) => <div key={index}><span>{index + 1}</span><input required maxLength={120} value={value} onChange={(event) => setOptions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Lựa chọn ${index + 1}`} />{options.length > 2 && <button type="button" aria-label={`Xóa lựa chọn ${index + 1}`} onClick={() => setOptions((items) => items.filter((_, itemIndex) => itemIndex !== index))}><FiX /></button>}</div>)}{options.length < 10 && <button type="button" onClick={() => setOptions((items) => [...items, ''])}><FiPlus /> Thêm lựa chọn</button>}</div></section>}
    <section className="composer-section"><div className="composer-section-heading"><FiImage /><div><strong>Hình ảnh</strong><small>Tối đa 5 ảnh JPG, PNG hoặc WebP · 5 MB mỗi ảnh</small></div></div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => addFiles(event.target.files)} /><button type="button" className="composer-upload" onClick={() => fileInput.current?.click()} disabled={files.length >= maxFiles}><FiImage /><strong>Chọn ảnh từ thiết bị</strong><small>{files.length}/{maxFiles} ảnh đã chọn</small></button>{previews.length > 0 && <div className="composer-previews">{previews.map(({ file, url }, index) => <div key={`${file.name}-${index}`}><img src={url} alt={`Ảnh xem trước ${index + 1}`} /><button type="button" aria-label={`Xóa ảnh ${index + 1}`} onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}><FiX /></button></div>)}</div>}</section>
    {error && <p className="composer-error" role="alert">{error}</p>}
    <div className="composer-footer"><span>Chia sẻ điều bạn yêu thích về phim ảnh.</span><button type="submit" disabled={sending || !title.trim() || (kind === 'review' && (!movie || !rating)) || (kind === 'poll' && options.some((value) => !value.trim()))}>{sending ? 'Đang đăng...' : 'Đăng bài'}</button></div>
  </form>;
}
