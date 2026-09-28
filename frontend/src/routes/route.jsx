import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import HomePage from "../modules/discovery/HomePage";
import AdminPage from "../admin/AdminPage";
import Test from "../admin/analytics/Test";
import Test1 from "../admin/users/Test";
import Test2 from "../admin/content/Test";
import Test3 from "../admin/community/Test";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
    ],
  },
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
]);
