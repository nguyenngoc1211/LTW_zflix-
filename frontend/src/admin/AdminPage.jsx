import {
  AppstoreOutlined,
  ExceptionOutlined,
  TeamOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { Layout, Menu, Dropdown, Space, Avatar } from "antd";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import React, { useEffect, useState, memo } from "react";
import Logo from "../components/Logo";
import Logo_Icon from "../assets/react.svg";
import { useAuth } from "../hooks/useAuth.js";

const { Content, Sider, Header: AntHeader } = Layout;

const MemoizedHeader = memo(({ collapsed, onToggle, username, onLogout }) => {
  const dropdownItems = [
    {
      label: <Link to="/">Homepage</Link>,
      key: "home",
      icon: <HomeOutlined />,
    },
    { type: "divider" },
    {
      label: <span style={{ cursor: "pointer" }}>Log out</span>,
      key: "logout",
      icon: <LogoutOutlined />,
      danger: true,
    },
  ];

  const urlAvatar = ``;

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
            <Avatar src={urlAvatar} />
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
      content: "content",
      community: "community",
    };
    return keyMap[lastSegment] || "analytics";
  };

  const activeMenuKey = getActiveMenuKey();

  const menuItems = [
    {
      label: <Link to="/admin">Analytics</Link>,
      key: "analytics",
      icon: <AppstoreOutlined />,
    },
    {
      label: <Link to="/admin/users">Users Management</Link>,
      key: "users",
      icon: <UserOutlined />,
    },
    {
      label: <Link to="/admin/content">Content Management</Link>,
      key: "content",
      icon: <ExceptionOutlined />,
    },
    {
      label: <Link to="/admin/community">Community Management</Link>,
      key: "community",
      icon: <TeamOutlined />,
    },
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
            {accessStatus === "checking" ? "Checking admin access..." :
              accessStatus === "denied" ? "Admin access denied" : "Could not verify admin access"}
          </h1>
          {accessStatus !== "checking" && (
            <Link className="mt-4 inline-block text-red-600 hover:underline" to="/">Back to homepage</Link>
          )}
        </div>
      </main>
    );
  }

  return (
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
          {collapsed ? (
            <img src={Logo_Icon} alt="Icon" className="h-8" />
          ) : (
            <Logo theme={"dark"} />
          )}
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
  );
};

export default AdminPage;
