import { Outlet } from "react-router-dom";

import { FinanceProvider } from "@/entities/finance";

import { TabBar } from "./TabBar";

export const MobileShell = () => (
  <FinanceProvider>
    <div className="min-h-dvh bg-gradient-to-b from-[#0e1013] via-[#0b0c0e] to-[#07080a] text-fg relative overflow-x-hidden selection:bg-emerald-500/20">
      {/* Top subtle ambient neo-banking emerald lighting */}
      <div className="pointer-events-none fixed -top-32 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-gradient-to-b from-emerald-500/10 via-emerald-900/5 to-transparent blur-3xl" />

      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col relative z-10">
        <main className="flex-1 pb-28">
          <Outlet />
        </main>
      </div>
      <TabBar />
    </div>
  </FinanceProvider>
);
