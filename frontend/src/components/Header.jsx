import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo";

const         Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to search results page (to be implemented)
      console.log("Searching for:", searchQuery);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="header-logo">
          <Logo />
          <div className="logo-text">
            <span className="logo-brand">RoPhim</span>
            <span className="logo-subtitle">Phim hay cả rổ</span>
          </div>
        </Link>

        {/* Search Bar */}
        <form className="header-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Tìm kiếm phim, diễn viên"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-btn" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </form>

        {/* Navigation Menu */}
        <nav className="header-nav">
          <Link to="/phim-le" className="nav-link">
            Phim Lẻ
          </Link>
          <Link to="/phim-bo" className="nav-link">
            Phim Bộ
          </Link>
          <div className="nav-dropdown">
            <button className="nav-link dropdown-btn">
              Thể loại
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
          </div>
          <div className="nav-dropdown">
            <button className="nav-link dropdown-btn">
              Quốc gia
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
          </div>
          <Link to="/xem-chung" className="nav-link">
            Xem Chung
          </Link>
          <div className="nav-dropdown">
            <button className="nav-link dropdown-btn">
              Thêm
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
          </div>
          <Link to="/ro-bong" className="nav-link nav-link-new">
            Rỏ Bỏng
            <span className="new-badge">NEW</span>
          </Link>
        </nav>

        {/* User Actions */}
        <div className="header-actions">
          <button className="header-download-btn" aria-label="Download app">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
            <span>Tải ứng dụng RoPhim</span>
          </button>
          <button className="header-user-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
            Thành viên
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
