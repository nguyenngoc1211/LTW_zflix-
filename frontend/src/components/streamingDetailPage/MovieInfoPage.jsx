import { useEffect, useState } from "react";
import { Spin } from "antd";
import { useParams } from "react-router-dom";
import { getMovieBySlug, getPopularMovies } from "../../services/movieService";

import InfoHero from "./InfoHero";
import RelatedMovies from "../streamingPage/RelatedMovies";
import RecommendedList from "../streamingPage/RecommendedList";
import CommentSection from "../streamingPage/CommentSection";

const MovieInfoPage = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [productionData, setProductionData] = useState(null);
  const [popularList, setPopularList] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // Fetch song song 2 API
    Promise.all([getMovieBySlug(slug), getPopularMovies()])
      .then(([movieData, popularData]) => {
        setProductionData(movieData);
        setPopularList(popularData); // Lưu data popular
      })
      .catch((err) => {
        console.error(err);
        message.error("Lỗi tải thông tin phim!");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Spin size="large" tip="Loading Info..." />
      </div>
    );

  const related = productionData?.related || [];

  return (
    <div className="min-h-screen bg-[#121212] text-gray-300 font-sans pb-10">
      {/* 1. HERO SECTION  */}
      <InfoHero production={productionData} />

      {/* 2. MAIN CONTENT LAYOUT */}
      <div className="container mx-auto px-4 max-w-[1400px]">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* --- CỘT TRÁI --- */}
          <div className="xl:col-span-9 space-y-10">
            <div className="border-t border-gray-800 pt-6">
              <RelatedMovies movies={related} />
            </div>

            <CommentSection />
          </div>

          {/* --- CỘT PHẢI --- */}
          <div className="xl:col-span-3">
            <div className="sticky top-4">
              <RecommendedList list={popularList} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieInfoPage;
