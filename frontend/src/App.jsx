import { Link, NavLink, Outlet } from "react-router-dom";

const App = () => {
  return (
    <div className="app">
      <header className="site-header"><Link to="/" className="brand">Z<span>FLIX</span></Link><nav><NavLink to="/">Khám phá</NavLink><NavLink to="/library">Thư viện</NavLink><NavLink to="/history">Lịch sử</NavLink><NavLink to="/notifications">Thông báo</NavLink></nav></header>
      <Outlet />
      <footer>© 2026 Zflix · Movie streaming platform</footer>
    </div>
  );
};

export default App;
