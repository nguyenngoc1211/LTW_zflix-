import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import AccountMenu from "./components/AccountMenu.jsx";
import NotificationBell from './components/NotificationBell.jsx';
import ChatbotWidget from './components/ChatbotWidget.jsx';

const App = () => {
  const { user } = useAuth();

  return (
    <div className="app">
      <header className="site-header">
        <Link to="/" className="brand">Z<span>FLIX</span></Link>
        <nav className="main-nav">
          <NavLink to="/">Khám phá</NavLink>
          <NavLink to="/library">Thư viện</NavLink>
          <NavLink to="/history">Lịch sử</NavLink>
          <NavLink to="/watch-party">Watch Party</NavLink>
          <NavLink to="/community">Cộng đồng</NavLink>
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
