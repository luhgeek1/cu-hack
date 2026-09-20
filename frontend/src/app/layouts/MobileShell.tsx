import { Outlet } from "react-router-dom";

import { FinanceProvider } from "@/entities/finance";

import { TabBar } from "./TabBar";

export const MobileShell = () => (
  <FinanceProvider>
    <div className="min-h-dvh bg-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col">
        <main className="flex-1 pb-28">
          <Outlet />
        </main>
      </div>
      <TabBar />
    </div>
  </FinanceProvider>
);
