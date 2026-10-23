import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { watchPartyApi, getCurrentUserId, setCurrentUserId } from "../services/api.js";

export default function Navbar({ onUserChange }) {
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [activeUserId, setActiveUserId] = useState(getCurrentUserId());

  useEffect(() => {
    watchPartyApi
      .getTestUsers()
      .then((data) => {
        if (data?.items?.length) setUsers(data.items);
      })
      .catch(() => {
        // Fallback danh sách nếu chưa có data
        setUsers([
          { id: 1, username: "admin", role: "admin" },
          { id: 2, username: "john.doe", role: "user" },
          { id: 3, username: "jane_smith", role: "user" },
        ]);
      });
  }, []);

  const handleSelectUser = (e) => {
    const newId = e.target.value;
    setActiveUserId(newId);
    setCurrentUserId(newId);
    if (onUserChange) onUserChange(newId);
  };

  const currentUser = users.find((u) => String(u.id) === String(activeUserId)) || {
    id: activeUserId,
    username: `User #${activeUserId}`,
    role: "user",
  };

  return (
    <header className="sticky top-0 z-50 glass-strong border-b border-white/10 px-4 lg:px-8 py-3.5 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 text-decoration-none group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-purple-600 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform">
            <span className="text-xl font-black text-white">Z</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white">Zflix</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">
                Party
              </span>
            </div>
            <p className="text-xs text-neutral-400 m-0">Module by Khoa</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/"
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              location.pathname === "/"
                ? "bg-white/10 text-white font-semibold"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Phòng đang chiếu
          </Link>

          <Link
            to="/create"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transition-all hover:scale-105 active:scale-95"
          >
            <span>+</span>
            <span>Tạo phòng</span>
          </Link>

          {/* Test User Switcher */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/10">
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-red-400">
              {currentUser.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Tài khoản test</span>
              <select
                value={activeUserId}
                onChange={handleSelectUser}
                className="bg-neutral-800/90 text-white text-xs border border-white/10 rounded px-2 py-1 outline-none focus:border-red-500 cursor-pointer"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-neutral-900 text-white">
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
