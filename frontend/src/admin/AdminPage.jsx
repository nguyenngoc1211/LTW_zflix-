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
import { Outlet, Link, useLocation } from "react-router-dom";
import React, { useState, memo } from "react";
import Logo from "../components/Logo";
import Logo_Icon from "../assets/react.svg";

const { Content, Sider, Header: AntHeader } = Layout;

const MemoizedHeader = memo(({ collapsed, onToggle }) => {
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
        <Dropdown menu={{ items: dropdownItems }} trigger={["click"]}>
          <Space className="cursor-pointer p-2 rounded-md">
            <Avatar src={urlAvatar} />
            <span className="font-medium text-gray-600">Admin</span>
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
  const location = useLocation();
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
        <MemoizedHeader collapsed={collapsed} onToggle={handleToggle} />
        <MemoizedContent />
      </Layout>
    </Layout>
  );
};

export default AdminPage;
