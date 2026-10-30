import { useEffect, useState } from "react";
import { ShoppingOutlined } from "@ant-design/icons";
import { apiRequest } from "../../services/api.js";

const formatTimestamp = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
};

const ProductPlacements = ({ productionId }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    if (!productionId) return () => { active = false; };
    apiRequest(`/api/v1/shopping/productions/${productionId}/products`)
      .then((data) => {
        if (active) setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [productionId]);

  if (!productionId || items.length === 0) return null;

  return (
    <div className="border-t border-gray-800 pt-6">
      <h3 className="text-[#ffdd95] font-bold text-xl mb-4 m-0">
        Sản phẩm trong phim
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {items.map((item) => {
          const keyword = item.shopeeKeyword || item.productName || "";
          return (
            <a
              key={item.id}
              href={`https://shopee.vn/search?keyword=${encodeURIComponent(keyword)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-44 shrink-0 rounded-xl border border-gray-800 bg-[#18181b] overflow-hidden hover:border-[#ffdd95]/60 transition-colors"
            >
              <div className="h-24 bg-[#121212] flex items-center justify-center overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName || "Sản phẩm"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ShoppingOutlined className="text-2xl text-gray-600" />
                )}
              </div>
              <div className="p-2.5">
                <p className="text-sm text-gray-200 font-medium line-clamp-2 m-0">
                  {item.productName}
                </p>
                <p className="text-xs text-gray-500 mt-1 mb-0">
                  {item.category}
                  {item.timestampStart != null && ` · ${formatTimestamp(item.timestampStart)}`}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default ProductPlacements;
