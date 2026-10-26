import {
  ExceptionOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { Layout, Menu, Dropdown, Space, Avatar } from "antd";
import { Outlet, Link, useLocation } from "react-router-dom";
import React, { useState, memo } from "react";
import AnonymousAvatar from "../assets/anonymous.png";

const { Content, Sider, Header: AntHeader } = Layout;

const MemoizedHeader = memo(({ collapsed, onToggle }) => {
  const dropdownItems = [
    {
      label: <Link to="/">Homepage</Link>,
      key: "home",
      icon: <HomeOutlined />,
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
            <Avatar src={urlAvatar.length == 0 ? AnonymousAvatar : urlAvatar} />
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
    <Content className="m-4 p-6 bg-[#1f1f1f] rounded-lg shadow-inner">
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
    const lastSegment = pathSegments.pop() || pathSegments.pop();

    const keyMap = {
      admin: "content",
      content: "content",
    };
    return keyMap[lastSegment] || "content";
  };

  const activeMenuKey = getActiveMenuKey();

  const menuItems = [
    {
      label: <Link to="/admin/content">Content Management</Link>,
      key: "content",
      icon: <ExceptionOutlined />,
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
          <Link
            to="/"
            className="text-2xl font-black !text-[#ffdd95] tracking-tight hover:opacity-90 transition-opacity"
          >
            ZFLIX
          </Link>
        </div>
        <Menu
          theme="dark"
          selectedKeys={[activeMenuKey]}
          mode="inline"
          items={menuItems}
        />
      </Sider>

      <Layout className="!bg-[#022c53] transition-all duration-300 ease-in-out">
        <MemoizedHeader collapsed={collapsed} onToggle={handleToggle} />
        <MemoizedContent />
      </Layout>
    </Layout>
  );
};

export default AdminPage;
