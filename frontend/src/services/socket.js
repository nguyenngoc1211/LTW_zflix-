import { io } from "socket.io-client";
import { API_URL, getAccessToken } from "./api.js";

let socketInstance = null;

export const getPartySocket = () => {
  if (!socketInstance) {
    socketInstance = io(`${API_URL}/watch-party`, {
      autoConnect: true,
      withCredentials: true,
      transports: ["websocket", "polling"],
      // Đọc token mỗi lần kết nối/reconnect để dùng access token mới nhất.
      auth: (callback) => callback({ token: getAccessToken() || "" }),
    });

    socketInstance.on("connect", () => {
      console.log("[Socket] Connected to /watch-party namespace, id:", socketInstance.id);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });
  }

  return socketInstance;
};

export const closePartySocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
