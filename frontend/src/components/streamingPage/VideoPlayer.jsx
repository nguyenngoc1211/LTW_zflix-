import { BulbOutlined, StepForwardOutlined } from "@ant-design/icons";
import { Button, Switch, Tooltip, message } from "antd";
import { useEffect, useRef } from "react";

import LensyMascot from "../LensyMascot";
import SelectionOverlay from "../SelectionOverlay";
import ProductPanel from "../ProductPanel";
import { useLensy } from "../../hooks/useLensy";

const VideoPlayer = ({
  currentEpisode,
  isLightOff,
  setLightOff,
  onNextEpisode,
  settings,
  setSettings,
  productionId,
  onTimeUpdate,
}) => {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const positionRef = useRef(0);

  // CineLens: quét đồ vật trong khung hình (Lensy)
  const lensy = useLensy({
    videoRef,
    stageRef,
    productionId: productionId ?? currentEpisode?.production_id,
    position: positionRef.current,
  });

  useEffect(() => {
    if (!videoRef.current || !settings.autoPlay) return;

    videoRef.current.play().catch(() => {});
  }, [currentEpisode, settings.autoPlay]);

  const handleLoadedMetadata = () => {
    const position = new URLSearchParams(window.location.search).get("pos");
    if (position && videoRef.current && !Number.isNaN(Number(position))) {
      videoRef.current.currentTime = Number(position);
    }
  };

  const handleTimeUpdate = () => {
    const t = videoRef.current?.currentTime || 0;
    positionRef.current = t;
    if (onTimeUpdate) onTimeUpdate(Math.floor(t));
  };

  const handleVideoEnded = () => {
    if (!settings.autoNext) return;
    message.loading("Tự động chuyển tập tiếp theo sau 3 giây...", 2);
    setTimeout(onNextEpisode, 3000);
  };

  const toggleSetting = (key) => {
    setSettings((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  return (
    <div
      ref={stageRef}
      className={`relative w-full overflow-hidden rounded-xl bg-black shadow-2xl ${
        isLightOff ? "z-50" : ""
      }`}
    >
      <div className="aspect-video w-full bg-black">
        <video
          ref={videoRef}
          key={currentEpisode.video_url}
          src={currentEpisode.video_url}
          controls
          crossOrigin="anonymous"
          className="h-full w-full object-contain"
          poster={currentEpisode.thumbnail_url}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
        />
      </div>

      {/* CineLens: overlay khoanh vùng + panel kết quả */}
      {lensy.isOpen && (
        <SelectionOverlay
          boundsRef={stageRef}
          scanning={lensy.state === "SCANNING"}
          onScan={lensy.scan}
          onCancel={lensy.sleep}
          onTooSmall={(m) => lensy.setError(m)}
          error={lensy.error}
        />
      )}
      {(lensy.state === "RESULTS" || lensy.state === "ERROR") && (
        <ProductPanel
          result={lensy.result || { message: lensy.error, products: [] }}
          photo={lensy.photo}
          onClose={lensy.sleep}
          onBuy={lensy.buy}
          onFind={lensy.findOnShopee}
        />
      )}
      {/* Ẩn mascot khi đang chọn vùng để không vướng thao tác kéo chuột;
          hiện lại ở các state khác để bấm ngủ/thức. */}
      {(lensy.state === "SLEEPING" || lensy.state === "AWAKE") && (
        <LensyMascot
          compact
          state={lensy.state}
          onClick={() => (lensy.state === "SLEEPING" ? lensy.wake() : lensy.sleep())}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-[#18181b] p-3">
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <span>
            Đang xem: <strong className="text-white">Tập {currentEpisode.episode_number}</strong>
          </span>
          <div className="hidden items-center gap-4 md:flex">
            <span>Auto Play <Switch size="small" checked={settings.autoPlay} onChange={() => toggleSetting("autoPlay")} /></span>
            <span>Auto Next <Switch size="small" checked={settings.autoNext} onChange={() => toggleSetting("autoNext")} /></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title={isLightOff ? "Bật đèn" : "Tắt đèn"}>
            <Button type="text" icon={<BulbOutlined />} onClick={() => setLightOff(!isLightOff)} />
          </Tooltip>
          <Button type="primary" shape="round" icon={<StepForwardOutlined />} onClick={onNextEpisode}>
            Tập tiếp theo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
