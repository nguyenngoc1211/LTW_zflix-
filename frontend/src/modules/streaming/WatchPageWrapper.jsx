import { useSearchParams } from "react-router-dom";
import WatchPage from "./WatchPage";
import MovieInfoPage from "../../components/streamingDetailPage/MovieInfoPage";

const WatchPageWrapper = () => {
  const [searchParams] = useSearchParams();
  const episode = searchParams.get("ep");

  return episode ? <WatchPage /> : <MovieInfoPage />;
};

export default WatchPageWrapper;
