import { Image, Divider } from "antd";
import {
  ClockCircleOutlined,
  GlobalOutlined,
  CalendarOutlined,
  StarFilled,
} from "@ant-design/icons";

import {
  PremiumTag,
  TypeTag,
  StatusTag,
  GenreTags,
} from "../../components/adminContent/ProductionTags";
import ActorList from "../../components/adminContent/ActorList";
import DescriptionBox from "../../components/adminContent/DescriptionBox";
import AnonymousBanner from "../../assets/anonymousBanner.png";

const ProductionDetail = ({ data }) => {
  if (!data) return null;

  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        <div className="w-48 flex-shrink-0">
          <Image
            width={200}
            src={data?.poster_url ? data.poster_url : AnonymousBanner}
            className="rounded-lg shadow-md object-cover"
            style={{ minHeight: "300px" }}
          />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-1">{data.title}</h2>
          <div className="mb-3 text-gray-500 italic text-sm">{data.slug}</div>

          <div className="flex flex-wrap gap-2 mb-4">
            <PremiumTag isPremium={data.is_premium} />
            <StatusTag status={data.status} />
            <TypeTag type={data.type} />
          </div>

          <div className="p-4 rounded-lg border border-gray-600 bg-gray-900/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <CalendarOutlined className="text-blue-500" /> Năm:{" "}
                <strong>{data.release_year}</strong>
              </div>
              <div className="flex items-center gap-2">
                <GlobalOutlined className="text-blue-500" /> QG:{" "}
                <strong>{data.country || "N/A"}</strong>
              </div>
              <div className="flex items-center gap-2">
                <StarFilled className="text-yellow-400" /> ĐG:{" "}
                <strong>{data.rating_avg}/5</strong>
              </div>
              <div className="flex items-center gap-2">
                <ClockCircleOutlined className="text-blue-500" />
                Thời lượng:{" "}
                <strong>
                  {data.type === "movie"
                    ? data.movies?.duration >= 60
                      ? `${Math.floor((data.movies?.duration || 0) / 60)} phút`
                      : `${data.movies?.duration || 0} giây`
                    : `${data.series?.total_seasons || 0} mùa`}
                </strong>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="text-gray-500 text-xs uppercase font-bold tracking-wide">
              Thể loại:
            </span>
            <div className="mt-1">
              <GenreTags genres={data.genres} />
            </div>
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}
      <Divider orientation="left">Nội dung phim</Divider>
      <DescriptionBox description={data.description} />

      {/* ACTORS */}
      <Divider orientation="left">Diễn viên & Đoàn làm phim</Divider>
      <ActorList actors={data.actors} />
    </div>
  );
};

export default ProductionDetail;
