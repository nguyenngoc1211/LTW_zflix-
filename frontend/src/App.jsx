import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";

const App = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div>
      <header className="flex items-center justify-between bg-slate-950 px-6 py-4 text-white">
        <Link to="/" className="text-xl font-bold text-red-500">MovieHub</Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span>{user.username} ({user.role})</span>
              <Link to="/account/security">Security</Link>
              {user.role === "admin" && <Link to="/admin">Admin</Link>}
              <button type="button" onClick={handleLogout} className="rounded bg-red-600 px-3 py-2">
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="rounded bg-red-600 px-3 py-2">Sign in</Link>
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  );
};

export default App;
