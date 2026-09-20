import { Navigate, Outlet, useLocation, useRoutes, type Location, type RouteObject } from "react-router-dom";

import { useAuth } from "@/app/providers/auth/useAuth";
import { MobileShell } from "@/app/layouts/MobileShell";
import { useQuery } from "@tanstack/react-query";

import { FinanceProvider, financeApi } from "@/entities/finance";
import { isOnboarded } from "@/features/onboarding/model/storage";
import OnboardingPage from "@/pages/onboarding/ui/OnboardingPage";
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

  // Финансовые данные нужны и онбордингу, и приложению
  return (
    <FinanceProvider>
      <Outlet />
    </FinanceProvider>
  );
};

/**
 * Пока у пользователя нет ни одного счёта, показываем онбординг.
 * Источник правды — бэкенд; локальный флаг нужен для «пройти заново».
 */
const RequireOnboarding = () => {
  const auth = useAuth();
  const email = auth?.user?.email as string | undefined;

  const accounts = useQuery({
    queryKey: ["finance", "accounts"],
    queryFn: financeApi.getAccounts,
    staleTime: 30_000,
  });

  if (accounts.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <p className="text-[14px] text-fg-muted">Загружаем данные…</p>
      </div>
    );
  }

  const hasData = (accounts.data?.length ?? 0) > 0;

  if (!hasData && !isOnboarded(email)) {
    return <Navigate to="/onboarding" replace />;
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
      { path: "onboarding", element: <OnboardingPage /> },
      {
        element: <RequireOnboarding />,
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
