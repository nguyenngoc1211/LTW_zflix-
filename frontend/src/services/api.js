export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

let accessToken = null;
let pendingRefresh = null;
let sessionBootstrapped = false;
let sessionInvalidHandler = null;
let currentUserId = localStorage.getItem("zflix_active_user_id") || "1";

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const setSessionInvalidHandler = (handler) => {
  sessionInvalidHandler = typeof handler === "function" ? handler : null;
};

// Dev helper (Watch Party): chuyển đổi user test trên cùng trình duyệt.
// Sau khi tích hợp auth, danh tính thật lấy từ JWT; header này chỉ là fallback.
export const setCurrentUserId = (userId) => {
  currentUserId = String(userId);
  localStorage.setItem("zflix_active_user_id", currentUserId);
};

export const getCurrentUserId = () => currentUserId;

const parseResponse = async (response) => {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
};

export const refreshSession = async () => {
  if (!pendingRefresh) {
    pendingRefresh = fetch(`${API_URL}/api/v1/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
    })
      .then(parseResponse)
      .then((data) => {
        setAccessToken(data.accessToken);
        return data;
      })
      .catch((error) => {
        setAccessToken(null);
        sessionInvalidHandler?.();
        throw error;
      })
      .finally(() => {
        pendingRefresh = null;
        sessionBootstrapped = true;
      });
  }
  return pendingRefresh;
};

// Chờ phiên đăng nhập được khôi phục trước khi gọi endpoint phụ thuộc người xem
// (vd: trạng thái khóa VIP), tránh gửi request khi chưa có access token.
const ensureSessionBootstrapped = () =>
  sessionBootstrapped ? Promise.resolve() : refreshSession().catch(() => {});

export const apiRequest = async (path, options = {}, retry = true) => {
  if (!path.startsWith("/api/v1/auth/")) {
    await ensureSessionBootstrapped();
  }
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  // Gửi x-user-id để hỗ trợ test chuyển đổi nhiều user trên cùng trình duyệt
  headers.set("x-user-id", getCurrentUserId());

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && retry && path !== "/api/v1/auth/refresh-token") {
    await refreshSession();
    return apiRequest(path, options, false);
  }

  return parseResponse(response);
};

// ---------------------------------------------------------------------------
// Watch Party API Services (branch Khoa)
// ---------------------------------------------------------------------------

export const watchPartyApi = {
  // Lấy danh sách phòng
  getParties: (query = "") => {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    return apiRequest(`/api/v1/watch-party${q}`);
  },

  // Chi tiết phòng
  getParty: (partyId) => {
    return apiRequest(`/api/v1/watch-party/${partyId}`);
  },

  // Tạo phòng mới
  createParty: ({ title, episodeId, password, maxParticipants }) => {
    return apiRequest("/api/v1/watch-party", {
      method: "POST",
      body: JSON.stringify({ title, episodeId, password, maxParticipants }),
    });
  },

  // Tham gia phòng
  joinParty: (partyId, password = null) => {
    return apiRequest(`/api/v1/watch-party/${partyId}/join`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  // Rời phòng
  leaveParty: (partyId) => {
    return apiRequest(`/api/v1/watch-party/${partyId}/leave`, {
      method: "POST",
    });
  },

  // Cập nhật playback
  updatePlayback: (partyId, { currentPosition, isPlaying }) => {
    return apiRequest(`/api/v1/watch-party/${partyId}/playback`, {
      method: "PATCH",
      body: JSON.stringify({ currentPosition, isPlaying }),
    });
  },

  // Gửi chat
  sendChat: (partyId, { message, timestampInVideo }) => {
    return apiRequest(`/api/v1/watch-party/${partyId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, timestampInVideo }),
    });
  },

  // Quản lý thành viên (host only: mute, unmute, promote, demote, kick)
  manageParticipant: (partyId, userId, action) => {
    return apiRequest(`/api/v1/watch-party/${partyId}/participants/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
  },

  // Cài đặt phòng
  updateSettings: (partyId, settings) => {
    return apiRequest(`/api/v1/watch-party/${partyId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  },

  // Lấy danh sách phim/tập để tạo phòng
  getAvailableEpisodes: () => {
    return apiRequest("/api/v1/watch-party-episodes");
  },

  // Lấy danh sách user mẫu để test
  getTestUsers: () => {
    return apiRequest("/api/v1/watch-party-users");
  },
};
