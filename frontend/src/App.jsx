import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";

const App = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <header className="site-header">
        <Link to="/" className="brand">Z<span>FLIX</span></Link>
        <nav className="main-nav">
          <NavLink to="/">Khám phá</NavLink>
          <NavLink to="/library">Thư viện</NavLink>
          <NavLink to="/history">Lịch sử</NavLink>
          <NavLink to="/notifications">Thông báo</NavLink>
          <NavLink to="/watch-party">Watch Party</NavLink>
        </nav>
        <div className="auth-nav">
          {user ? (
            <>
              <span className="auth-user" title={user.username}>{user.username}<span className="auth-role"> ({user.role})</span></span>
              <Link to="/account/security">Bảo mật</Link>
              {user.role === "admin" && <Link to="/admin">Admin</Link>}
              <button type="button" onClick={handleLogout} className="logout-button">
                Đăng xuất
              </button>
            </>
          ) : (
            <Link to="/login" className="signin-button">Đăng nhập</Link>
          )}
        </div>
      </header>
      <Outlet />
      <footer>© 2026 Zflix · Movie streaming platform</footer>
    </div>
  );
};

export default App;
