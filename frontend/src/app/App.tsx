import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { useAuth } from "@/app/providers/auth/useAuth";
import { AppRoutes } from "@/app/routes/AppRoutes";

function App() {
  const authData = useAuth();

  if (!authData) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink px-6">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <h1 className="text-[16px] font-semibold text-destructive">Ошибка конфигурации</h1>
        </div>
      </div>
    );
  }

  const {
    isUserLoading,
    isRestoringSession
  } = authData;

  if (isRestoringSession) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <p className="text-[14px] text-fg-muted">Загрузка…</p>
      </div>
    );
  }

  if (isUserLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <p className="text-[14px] text-fg-muted">Загрузка…</p>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
