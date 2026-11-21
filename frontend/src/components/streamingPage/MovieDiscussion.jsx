import CommentSection from './CommentSection.jsx';

export default function MovieDiscussion({ productionId, episodeId }) {
  return <section className="movie-discussion"><CommentSection productionId={productionId} episodeId={episodeId} showLegacy /></section>;
}
