import {
  AppstoreOutlined,
  PlaySquareOutlined,
  TeamOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  HomeOutlined,
  BarChartOutlined,
  ExceptionOutlined,
  DollarOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import { Layout, Menu, Dropdown, Space, Avatar, ConfigProvider } from "antd";
import { ProConfigProvider, viVNIntl } from "@ant-design/pro-components";
import viVN from "antd/locale/vi_VN";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import React, { useEffect, useState, memo } from "react";
import Logo from "../components/Logo";
import { useAuth } from "../hooks/useAuth.js";

const { Content, Sider, Header: AntHeader } = Layout;

const MemoizedHeader = memo(({ collapsed, onToggle, username, onLogout }) => {
  const dropdownItems = [
    {
      label: <Link to="/">Về trang người dùng</Link>,
      key: "home",
      icon: <HomeOutlined />,
    },
    { type: "divider" },
    {
      label: <span style={{ cursor: "pointer" }}>Đăng xuất</span>,
      key: "logout",
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];

  return (
    <AntHeader className="!p-0 flex items-center justify-between shadow-sm sticky top-0 z-10 ">
      <div className="flex items-center">
        {React.createElement(
          collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
          {
            className:
              "trigger text-lg px-6 cursor-pointer h-full flex items-center !text-white",
            onClick: onToggle,
          },
        )}
      </div>
      <div className="pr-6">
        <Dropdown
          menu={{
            items: dropdownItems,
            onClick: ({ key }) => {
              if (key === "logout") onLogout();
            },
          }}
          trigger={["click"]}
        >
          <Space className="cursor-pointer p-2 rounded-md">
            <Avatar icon={<UserOutlined />} />
            <span className="font-medium text-white">{username}</span>
          </Space>
        </Dropdown>
      </div>
    </AntHeader>
  );
});

MemoizedHeader.displayName = "MemoizedHeader";

const MemoizedContent = memo(() => {
  return (
    <Content className="m-4 p-6 bg-white rounded-lg shadow-inner">
      <Outlet />
    </Content>
  );
});
MemoizedContent.displayName = "MemoizedContent";

const AdminPage = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [accessStatus, setAccessStatus] = useState("checking");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, apiRequest } = useAuth();

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/admin/check")
      .then(() => {
        if (active) setAccessStatus("allowed");
      })
      .catch((error) => {
        if (active) setAccessStatus(error.status === 403 ? "denied" : "error");
      });
    return () => {
      active = false;
    };
  }, [apiRequest]);
  const getActiveMenuKey = () => {
    const pathSegments = location.pathname.split("/");
    const lastSegment = pathSegments.pop() || pathSegments.pop(); // Xử lý trường hợp trailing slash

    const keyMap = {
      admin: "analytics",
      users: "users",
      movies: "movies",
      content: "content",
      community: "community",
      parties: "parties",
      subscriptions: "subscriptions",
      views: "views",
      shopping: "shopping",
      security: "security",
      settings: "settings",
    };
    return keyMap[lastSegment] || "analytics";
  };

  const activeMenuKey = getActiveMenuKey();

  const menuItems = [
    {
      label: <Link to="/admin">Tổng quan</Link>,
      key: "analytics",
      icon: <AppstoreOutlined />,
    },
    {
      label: <Link to="/admin/movies">Quản lý phim</Link>,
      key: "movies",
      icon: <PlaySquareOutlined />,
    },
    {
      label: <Link to="/admin/content">Kho phim & tập</Link>,
      key: "content",
      icon: <PlaySquareOutlined />,
    },
    {
      label: <Link to="/admin/community">Cộng đồng</Link>,
      key: "community",
      icon: <TeamOutlined />,
    },
    {
      label: <Link to="/admin/parties">Watch Party</Link>,
      key: "parties",
      icon: <ExceptionOutlined />,
    },
    {
      label: <Link to="/admin/shopping">Mua sắm trong phim</Link>,
      key: "shopping",
      icon: <ShoppingOutlined />,
    },
    {
      label: <Link to="/admin/views">Thống kê lượt xem</Link>,
      key: "views",
      icon: <BarChartOutlined />,
    },
    ...(user?.role === "admin"
      ? [
          {
            label: <Link to="/admin/users">Quản lý người dùng</Link>,
            key: "users",
            icon: <UserOutlined />,
          },
          {
            label: <Link to="/admin/subscriptions">VIP & Doanh thu</Link>,
            key: "subscriptions",
            icon: <DollarOutlined />,
          },
          {
            label: <Link to="/admin/security">Nhật ký bảo mật</Link>,
            key: "security",
            icon: <SafetyOutlined />,
          },
          {
            label: <Link to="/admin/settings">Cài đặt hệ thống</Link>,
            key: "settings",
            icon: <SettingOutlined />,
          },
        ]
      : []),
  ];

  const handleToggle = () => setCollapsed(!collapsed);
  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (accessStatus !== "allowed") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            {accessStatus === "checking" ? "Đang kiểm tra quyền quản trị..." :
              accessStatus === "denied" ? "Không có quyền quản trị" : "Không thể xác minh quyền quản trị"}
          </h1>
          {accessStatus !== "checking" && (
            <Link className="mt-4 inline-block text-red-600 hover:underline" to="/">Về trang chủ</Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <ConfigProvider locale={viVN}>
      <ProConfigProvider intl={viVNIntl}>
        <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={230}
        trigger={null}
        collapsedWidth={80}
        collapsed={collapsed}
        theme="dark"
        className="shadow-sm transition-all duration-300 ease-in-out transform-gpu will-change-transform"
      >
        <div className="flex items-center justify-center h-16">
          <Logo theme={"dark"} />
        </div>
        <Menu
          theme="dark"
          selectedKeys={[activeMenuKey]}
          mode="inline"
          items={menuItems}
        />
      </Sider>

      <Layout className="!bg-gray-200 transition-all duration-300 ease-in-out">
        <MemoizedHeader
          collapsed={collapsed}
          onToggle={handleToggle}
          username={user.username}
          onLogout={handleLogout}
        />
        <MemoizedContent />
      </Layout>
        </Layout>
      </ProConfigProvider>
    </ConfigProvider>
  );
};

export default AdminPage;
