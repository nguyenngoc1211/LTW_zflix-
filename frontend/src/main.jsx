import '@ant-design/v5-patch-for-react-19';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes/route.jsx";
import { ConfigProvider, theme } from "antd";
import enUS from "antd/locale/en_US";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConfigProvider locale={enUS} theme={{ algorithm: theme.darkAlgorithm }}>
      <RouterProvider router={router} />
    </ConfigProvider>
  </StrictMode>,
);
