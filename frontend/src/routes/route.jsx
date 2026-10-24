import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import HomePage from "../modules/discovery/HomePage";
import AdminPage from "../admin/AdminPage";
import Test from "../admin/analytics/Test";
import Test1 from "../admin/users/Test";
import Test2 from "../admin/content/Test";
import Test3 from "../admin/community/Test";
import LoginPage from "../modules/auth/LoginPage";
import AccountSecurityPage from "../modules/auth/AccountSecurityPage";
import ForgotPasswordPage from "../modules/auth/ForgotPasswordPage";
import ResetPasswordPage from "../modules/auth/ResetPasswordPage";
import RegisterPage from "../modules/auth/RegisterPage";
import ProtectedRoute from "./ProtectedRoute";
import MovieDetailPage from "../modules/discovery/MovieDetailPage";
import LibraryPage from "../modules/community/LibraryPage";
import HistoryPage from "../modules/streaming/HistoryPage";
import NotificationsPage from "../modules/community/NotificationsPage";
import PlayerPage from "../modules/streaming/PlayerPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      { path: "movies/:id", element: <MovieDetailPage /> },
      { path: "watch/:episodeId", element: <PlayerPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "library", element: <LibraryPage /> },
          { path: "history", element: <HistoryPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          {
            path: "account/security",
            element: <AccountSecurityPage />,
          },
        ],
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        path: "/admin",
        element: <AdminPage />,
        children: [
          {
            index: true,
            element: <Test />,
          },
          {
            path: "/admin/users",
            element: <Test1 />,
          },
          {
            path: "/admin/content",
            element: <Test2 />,
          },
          {
            path: "/admin/community",
            element: <Test3 />,
          },
        ],
      },
    ],
  },
]);
