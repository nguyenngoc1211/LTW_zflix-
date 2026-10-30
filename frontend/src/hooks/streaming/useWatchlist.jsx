import { useCallback, useEffect, useState } from "react";
import { message } from "antd";
import { useAuth } from "../useAuth.js";
import { apiRequest } from "../../services/api.js";

const useWatchlist = (productionId) => {
  const { user } = useAuth();
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user || !productionId) {
      setIsInWatchlist(false);
      return () => { active = false; };
    }
    setChecking(true);
    apiRequest("/api/v1/favorites")
      .then((data) => {
        if (!active) return;
        setIsInWatchlist(
          (data.items || []).some((item) => item.id === Number(productionId)),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [user, productionId]);

  const toggleWatchlist = useCallback(async () => {
    if (!user) {
      message.info("Đăng nhập để lưu phim vào danh sách của bạn.");
      return;
    }
    if (!productionId) return;
    setSaving(true);
    try {
      if (isInWatchlist) {
        await apiRequest(`/api/v1/favorites/${productionId}`, { method: "DELETE" });
        setIsInWatchlist(false);
        message.success("Đã xoá khỏi danh sách yêu thích.");
      } else {
        await apiRequest(`/api/v1/favorites/${productionId}`, { method: "PUT" });
        setIsInWatchlist(true);
        message.success("Đã thêm vào danh sách yêu thích.");
      }
    } catch (error) {
      message.error(error.message || "Không cập nhật được danh sách.");
    } finally {
      setSaving(false);
    }
  }, [user, productionId, isInWatchlist]);

  return {
    isInWatchlist,
    loading: saving || checking,
    toggleWatchlist,
  };
};

export default useWatchlist;
