import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import AccountMenu from "./components/AccountMenu.jsx";
import NotificationBell from './components/NotificationBell.jsx';
import ChatbotWidget from './components/ChatbotWidget.jsx';

const App = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(() => window.scrollY > 32);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="app">
      <header className={`site-header${isHome ? " is-home" : ""}${scrolled ? " is-scrolled" : ""}`}>
        <Link to="/" className="brand">Z<span>FLIX</span></Link>
        <nav className="main-nav">
          <NavLink to="/">Khám phá</NavLink>
          <NavLink to="/library">Thư viện</NavLink>
          <NavLink to="/history">Lịch sử</NavLink>
          <NavLink to="/watch-party">Watch Party</NavLink>
          <NavLink to="/community">Cộng đồng</NavLink>
          <NavLink to="/vip">VIP</NavLink>
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="auth-nav">
          <NotificationBell />
          {user ? (
            <AccountMenu />
          ) : (
            <Link to="/login" className="signin-button">Đăng nhập</Link>
          )}
        </div>
      </header>
      <Outlet />
      <ChatbotWidget />
      <footer>© 2026 Zflix · Movie streaming platform</footer>
    </div>
  );
};

export default App;
