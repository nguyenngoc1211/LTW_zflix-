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
        if (data.mfaRequired) return data;
        setAccessToken(data.accessToken);
        setUser(data.user);
        return { user: data.user };
      },
      async verifyMfa(challengeToken, code) {
        const data = await apiRequest(
          "/api/v1/auth/mfa/verify",
          { method: "POST", body: JSON.stringify({ challengeToken, code }) },
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
      async logoutAll() {
        try {
          await apiRequest("/api/v1/auth/logout-all", { method: "POST" }, false);
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
      async changePassword(currentPassword, newPassword) {
        const result = await apiRequest("/api/v1/auth/change-password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        setAccessToken(null);
        setUser(null);
        return result;
      },
      clearAuthState() {
        setAccessToken(null);
        setUser(null);
      },
      apiRequest,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
