import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import HomePage from "../modules/discovery/HomePage";
import AdminPage from "../admin/AdminPage";
import DashboardPage from "../admin/analytics/DashboardPage.jsx";
import UsersAdminPage from "../admin/users/UsersAdminPage.jsx";
import MoviesAdminPage from "../admin/content/MoviesAdminPage.jsx";
import ContentTable from "../admin/content/ContentTable.jsx";
import ViewsPage from "../admin/analytics/ViewsPage.jsx";
import PointsAdminPage from "../admin/community/PointsAdminPage.jsx";
import PartiesAdminPage from "../admin/community/PartiesAdminPage.jsx";
import VipPage from "../modules/vip/VipPage.jsx";
import SecurityAdminPage from "../admin/security/SecurityAdminPage.jsx";
import SettingsAdminPage from "../admin/settings/SettingsAdminPage.jsx";
import ShoppingAdminPage from "../admin/shopping/ShoppingAdminPage.jsx";
import AdminLoginPage from "../modules/auth/AdminLoginPage.jsx";
import LoginPage from "../modules/auth/LoginPage";
import SettingsPage from "../modules/auth/SettingsPage.jsx";
import ForgotPasswordPage from "../modules/auth/ForgotPasswordPage";
import ResetPasswordPage from "../modules/auth/ResetPasswordPage";
import RegisterPage from "../modules/auth/RegisterPage";
import ProtectedRoute from "./ProtectedRoute";
import MoviePage from "../modules/streaming/MoviePage";
import LibraryPage from "../modules/community/LibraryPage";
import HistoryPage from "../modules/streaming/HistoryPage";
import NotificationsPage from "../modules/community/NotificationsPage";
import EpisodeRedirect from "../modules/streaming/EpisodeRedirect";
import PartyList from "../pages/PartyList.jsx";
import CreateParty from "../pages/CreateParty.jsx";
import PartyRoom from "../pages/PartyRoom.jsx";
import CommunityPage from "../modules/community/CommunityPage.jsx";
import CommunityProfilePage from "../modules/community/CommunityProfilePage.jsx";
import LeaderboardPage from "../modules/community/LeaderboardPage.jsx";
import QuestsPage from "../modules/community/QuestsPage.jsx";
import QuestsAdminPage from "../admin/community/QuestsAdminPage.jsx";
import ModerationAdminPage from "../admin/community/ModerationAdminPage.jsx";
import CommunityHubLayout from "../admin/community/CommunityHubLayout.jsx";
import CommunityContentPage from "../admin/community/CommunityContentPage.jsx";
import VipHubPage from "../admin/community/VipHubPage.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      // Trang chi tiết + trình phát dùng chung một route:
      //   /movies/:id        -> MovieInfoPage (thông tin phim)
      //   /movies/:id?ep=1   -> WatchPage (trình phát, chọn mùa/tập)
      { path: "movies/:id", element: <MoviePage /> },
      { path: "community", element: <CommunityPage /> },
      { path: "leaderboard", element: <LeaderboardPage /> },
      { path: "community/create", element: <CommunityPage view="create" /> },
      { path: "community/posts/:id", element: <CommunityPage view="detail" /> },
      { path: "community/users/:id", element: <CommunityProfilePage /> },
      { path: "community/scene-questions/:id", element: <CommunityPage view="detail" scene /> },
      // Route xem theo episode id, dùng cho lịch sử xem (không có slug).
      { path: "watch-episode/:episodeId", element: <EpisodeRedirect /> },
      { path: "watch-party", element: <PartyList /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "library", element: <LibraryPage /> },
          { path: "community/saved", element: <CommunityPage view="saved" /> },
          { path: "history", element: <HistoryPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          { path: "quests", element: <QuestsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "vip", element: <VipPage /> },
          { path: "account/profile", element: <Navigate to="/settings?tab=profile" replace /> },
          { path: "watch-party/create", element: <CreateParty /> },
          { path: "watch-party/room/:partyId", element: <PartyRoom /> },
          {
            path: "account/security",
            element: <Navigate to="/settings?tab=security" replace />,
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
            element: <Navigate to="/admin/community-hub" replace />,
          },
          { path: "/admin/movies", element: <MoviesAdminPage /> },
          { path: "/admin/content", element: <ContentTable /> },
          { path: "/admin/community", element: <Navigate to="/admin/community-hub/content?view=movies" replace /> },
          { path: "/admin/parties", element: <PartiesAdminPage /> },
          { path: "/admin/shopping", element: <ShoppingAdminPage /> },
          { path: "/admin/views", element: <ViewsPage /> },
          { path: "/admin/vip-payments", element: <Navigate to="/admin/community-hub/vip?view=payments" replace /> },
          { path: "/admin/moderation", element: <Navigate to="/admin/community-hub/moderation" replace /> },
          { path: "/admin/community-hub", element: <CommunityHubLayout />, children: [
            { index: true, element: <DashboardPage /> },
            { path: "content", element: <CommunityContentPage /> },
            { path: "moderation", element: <ModerationAdminPage /> },
            { path: "vip", element: <VipHubPage /> },
            { element: <ProtectedRoute allowedRoles={["admin"]} />, children: [
              { path: "users", element: <UsersAdminPage /> },
              { path: "points", element: <PointsAdminPage /> },
              { path: "quests", element: <QuestsAdminPage /> },
            ] },
          ] },
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [
              { path: "/admin/users", element: <Navigate to="/admin/community-hub/users" replace /> },
              { path: "/admin/subscriptions", element: <Navigate to="/admin/community-hub/vip" replace /> },
              { path: "/admin/security", element: <SecurityAdminPage /> },
              { path: "/admin/settings", element: <SettingsAdminPage /> },
              { path: "/admin/points", element: <Navigate to="/admin/community-hub/points" replace /> },
              { path: "/admin/quests", element: <Navigate to="/admin/community-hub/quests" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);
