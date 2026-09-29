const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

let accessToken = null;
let pendingRefresh = null;
let sessionInvalidHandler = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const setSessionInvalidHandler = (handler) => {
  sessionInvalidHandler = typeof handler === "function" ? handler : null;
};

const parseResponse = async (response) => {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
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
      });
  }
  return pendingRefresh;
};

export const apiRequest = async (path, options = {}, retry = true) => {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

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
