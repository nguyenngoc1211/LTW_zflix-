import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import HomePage from "../modules/discovery/HomePage";
import WatchPageWrapper from "../modules/streaming/WatchPageWrapper";
import NotFoundPage from "../components/streamingPage/NotFoundPage";
import AdminPage from "../admin/AdminPage";
import ContentTable from "../admin/content/ContentTable";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "watch/:slug", element: <WatchPageWrapper /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminPage />,
    children: [
      { index: true, element: <ContentTable /> },
      { path: "content", element: <ContentTable /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
