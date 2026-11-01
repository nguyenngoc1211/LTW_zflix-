import { useState } from 'react';
import CommentSection from './CommentSection.jsx';
import AllDiscussion from './AllDiscussion.jsx';

export default function MovieDiscussion({ productionId, episodeId, version }) {
  const [commentVersion, setCommentVersion] = useState(0);

  return <section className="movie-discussion space-y-4">
    <CommentSection productionId={productionId} composerOnly onSubmitted={() => setCommentVersion((value) => value + 1)} />
    <AllDiscussion key={`${productionId}:${episodeId}:${commentVersion}`} productionId={productionId} version={commentVersion} />
    <AllDiscussion key={`scenes:${productionId}:${episodeId}`} productionId={productionId} version={version} scene />
  </section>;
}
