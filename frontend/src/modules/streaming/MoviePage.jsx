import { useSearchParams } from "react-router-dom";
import WatchPage from "./WatchPage";
import MovieInfoPage from "../../components/streamingDetailPage/MovieInfoPage";

const MoviePage = () => {
  const [searchParams] = useSearchParams();
  const episode = searchParams.get("ep");

  return episode ? <WatchPage /> : <MovieInfoPage />;
};

export default MoviePage;
