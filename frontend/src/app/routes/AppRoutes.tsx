import { Navigate, Outlet, useLocation, useRoutes, type Location, type RouteObject } from "react-router-dom";

import { useAuth } from "@/app/providers/auth/useAuth";
import { MobileShell } from "@/app/layouts/MobileShell";
import AccountsPage from "@/pages/accounts/ui/AccountsPage";
import AnalyticsPage from "@/pages/analytics/ui/AnalyticsPage";
import AuthPage from "@/pages/auth/ui/AuthPage";
import EventsPage from "@/pages/events/ui/EventsPage";
import HomePage from "@/pages/home/ui/HomePage";
import ProfilePage from "@/pages/profile/ui/ProfilePage";

const RequireAuth = () => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth) {
    throw new Error("Auth context is unavailable. Wrap routes with <AuthProvider>.");
  }

  if (!auth.user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

const RedirectIfAuthenticated = () => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth) {
    throw new Error("Auth context is unavailable. Wrap routes with <AuthProvider>.");
  }

  if (auth.user) {
    const state = location.state as { from?: Location } | undefined;
    const from = state?.from;
    const targetPath =
      from && from.pathname && from.pathname !== "/auth" ? from.pathname : "/";

    return <Navigate to={targetPath} replace />;
  }

  return <AuthPage />;
};

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <MobileShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "events", element: <EventsPage /> },
          { path: "analytics", element: <AnalyticsPage /> },
          { path: "accounts", element: <AccountsPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    path: "/auth",
    element: <RedirectIfAuthenticated />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
];

export const AppRoutes = () => useRoutes(routes);
