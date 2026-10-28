import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import HomePage from "../modules/discovery/HomePage";
import AdminPage from "../admin/AdminPage";
import DashboardPage from "../admin/analytics/DashboardPage.jsx";
import UsersAdminPage from "../admin/users/UsersAdminPage.jsx";
import MoviesAdminPage from "../admin/content/MoviesAdminPage.jsx";
import ContentTable from "../admin/content/ContentTable.jsx";
import ViewsPage from "../admin/analytics/ViewsPage.jsx";
import CommunityAdminPage from "../admin/community/CommunityAdminPage.jsx";
import PartiesAdminPage from "../admin/community/PartiesAdminPage.jsx";
import SubscriptionsAdminPage from "../admin/subscriptions/SubscriptionsAdminPage.jsx";
import SecurityAdminPage from "../admin/security/SecurityAdminPage.jsx";
import SettingsAdminPage from "../admin/settings/SettingsAdminPage.jsx";
import ShoppingAdminPage from "../admin/shopping/ShoppingAdminPage.jsx";
import AdminLoginPage from "../modules/auth/AdminLoginPage.jsx";
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
import WatchPageWrapper from "../modules/streaming/WatchPageWrapper";
import PartyList from "../pages/PartyList.jsx";
import CreateParty from "../pages/CreateParty.jsx";
import PartyRoom from "../pages/PartyRoom.jsx";

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
      // Theo thiết kế (docs/project-analysis §4.7): /watch/:slug
      //   không có ?ep= -> MovieInfoPage (thông tin phim + seasons)
      //   có ?ep=      -> WatchPage (trình phát + chọn mùa/tập)
      // WatchPageWrapper đã implement đúng logic này.
      { path: "watch/:slug", element: <WatchPageWrapper /> },
      // Route xem theo episode id, dùng cho lịch sử xem (không có slug).
      { path: "watch-episode/:episodeId", element: <PlayerPage /> },
      { path: "watch-party", element: <PartyList /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "library", element: <LibraryPage /> },
          { path: "history", element: <HistoryPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          { path: "watch-party/create", element: <CreateParty /> },
          { path: "watch-party/room/:partyId", element: <PartyRoom /> },
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
    path: "/admin-login",
    element: <AdminLoginPage />,
  },
  {
    element: <ProtectedRoute allowedRoles={["admin", "moderator"]} />,
    children: [
      {
        path: "/admin",
        element: <AdminPage />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          { path: "/admin/movies", element: <MoviesAdminPage /> },
          { path: "/admin/content", element: <ContentTable /> },
          { path: "/admin/community", element: <CommunityAdminPage /> },
          { path: "/admin/parties", element: <PartiesAdminPage /> },
          { path: "/admin/shopping", element: <ShoppingAdminPage /> },
          { path: "/admin/views", element: <ViewsPage /> },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [
              { path: "/admin/users", element: <UsersAdminPage /> },
              { path: "/admin/subscriptions", element: <SubscriptionsAdminPage /> },
              { path: "/admin/security", element: <SecurityAdminPage /> },
              { path: "/admin/settings", element: <SettingsAdminPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
