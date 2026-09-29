import { useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  refreshSession,
  setAccessToken,
  setSessionInvalidHandler,
} from "../services/api.js";
import { AuthContext } from "./auth-context.js";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const clearInvalidSession = () => {
      if (active) setUser(null);
    };
    setSessionInvalidHandler(clearInvalidSession);
    refreshSession()
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      setSessionInvalidHandler(null);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(email, password) {
        const data = await apiRequest(
          "/api/v1/auth/login",
          { method: "POST", body: JSON.stringify({ email, password }) },
          false,
        );
        setAccessToken(data.accessToken);
        setUser(data.user);
        return data.user;
      },
      async logout() {
        try {
          await apiRequest("/api/v1/auth/logout", { method: "POST" }, false);
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
      apiRequest,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
