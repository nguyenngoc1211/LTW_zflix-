import {
  BulbOutlined,
  LockOutlined,
  StepForwardOutlined,
} from "@ant-design/icons";
import { Button, Tooltip, message } from "antd";
import { useEffect, useRef } from "react";

import LensyMascot from "../LensyMascot";
import SelectionOverlay from "../SelectionOverlay";
import ProductPanel from "../ProductPanel";
import { useLensy } from "../../hooks/useLensy";
import { useVideoSource } from "../../hooks/useVideoSource";

const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    style={{
      width: 36,
      height: 20,
      padding: 2,
      border: 0,
      borderRadius: 9999,
      background: checked ? "#dc2626" : "#52525b",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: checked ? "flex-end" : "flex-start",
      cursor: "pointer",
      transition: "background 0.2s",
      flexShrink: 0,
    }}
  >
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
        display: "block",
      }}
    />
  </button>
);

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
  const isLocked = Boolean(currentEpisode?.locked);

  // CineLens: quét đồ vật trong khung hình (Lensy)
  const lensy = useLensy({
    videoRef,
    stageRef,
    productionId: productionId ?? currentEpisode?.production_id,
    position: positionRef.current,
  });

  // Phát video: proxy R2 qua backend + hls.js cho .m3u8 (Chrome/Firefox).
  // R2 không có CORS nên không thể dùng src trực tiếp.
  useVideoSource({ videoRef, videoUrl: currentEpisode?.video_url });

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
      <div className="relative aspect-video w-full bg-black">
        {/* src do useVideoSource() gắn (proxy R2 + hls.js), không set inline. */}
        {isLocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <LockOutlined className="text-4xl text-amber-400" />
            <p className="text-base font-semibold text-white">
              Nội dung dành cho thành viên VIP
            </p>
            <p className="max-w-md text-sm text-gray-400">
              Bạn cần tài khoản VIP để xem tập này. Liên hệ quản trị viên để kích hoạt.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              key={currentEpisode.id}
              controls
              crossOrigin="anonymous"
              className="h-full w-full object-contain"
              poster={currentEpisode.thumbnail_url}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
            />
            {!currentEpisode.video_url && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-gray-400">
                Video chưa sẵn sàng. Nếu vừa upload, quá trình xử lý có thể chưa hoàn tất.
              </div>
            )}
          </>
        )}
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
      {/* Mascot được render trong thanh điều khiển bên dưới (cạnh nút đèn),
          ẩn khi đang chọn vùng để không vướng thao tác kéo chuột. */}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 bg-[#18181b] p-3">
        <div className="flex items-center gap-4 text-sm text-gray-300">
          <span>
            Đang xem: <strong className="text-white">Tập {currentEpisode.episode_number}</strong>
          </span>
          <div className="hidden items-center gap-4 md:flex">
            <span className="flex items-center gap-2">
              Auto Play
              <Toggle
                checked={settings.autoPlay}
                onChange={() => toggleSetting("autoPlay")}
                label="Auto Play"
              />
            </span>
            <span className="flex items-center gap-2">
              Auto Next
              <Toggle
                checked={settings.autoNext}
                onChange={() => toggleSetting("autoNext")}
                label="Auto Next"
              />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(lensy.state === "SLEEPING" || lensy.state === "AWAKE") && !isLocked && (
            <LensyMascot
              inline
              state={lensy.state}
              onClick={() => (lensy.state === "SLEEPING" ? lensy.wake() : lensy.sleep())}
            />
          )}
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
