import { useState } from 'react';
import CommentSection from './CommentSection.jsx';
import AllDiscussion from './AllDiscussion.jsx';

export default function MovieDiscussion({ productionId, episodeId, version }) {
  const [allEpisodes, setAllEpisodes] = useState(false);
  const [commentVersion, setCommentVersion] = useState(0);

  return <section className="space-y-4">
    <CommentSection productionId={productionId} composerOnly onSubmitted={() => setCommentVersion((value) => value + 1)} />
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={allEpisodes} onChange={(event) => setAllEpisodes(event.target.checked)} />Xem khoảnh khắc của tất cả tập</label>
    <AllDiscussion key={`${productionId}:${episodeId}:${allEpisodes}:${commentVersion}`} productionId={productionId} episodeId={episodeId} allEpisodes={allEpisodes} version={version} />
  </section>;
}
