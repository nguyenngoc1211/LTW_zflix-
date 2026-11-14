import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CommentSection from './CommentSection.jsx';
import AllDiscussion from './AllDiscussion.jsx';

export default function MovieDiscussion({ productionId, episodeId, version }) {
  const [commentVersion, setCommentVersion] = useState(0);
  const [searchParams] = useSearchParams();
  const hasCommentTarget = /^[1-9]\d*$/.test(searchParams.get('commentId') || '');

  return <section className="movie-discussion space-y-4">
    <CommentSection productionId={productionId} episodeId={episodeId} composerOnly={!hasCommentTarget} onSubmitted={() => setCommentVersion((value) => value + 1)} />
    {!hasCommentTarget && <AllDiscussion key={`${productionId}:${episodeId}:${commentVersion}`} productionId={productionId} episodeId={episodeId} version={commentVersion} />}
    <AllDiscussion key={`scenes:${productionId}:${episodeId}`} productionId={productionId} version={version} scene />
  </section>;
}
