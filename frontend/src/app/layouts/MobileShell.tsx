import { Outlet } from "react-router-dom";

import { VoiceButton } from "@/features/voice/ui/VoiceButton";

import { DesktopSidebar } from "./DesktopSidebar";
import { TabBar } from "./TabBar";

export const MobileShell = () => (
  <>
    <div className="min-h-dvh bg-gradient-to-b from-[#0e1013] via-[#0b0c0e] to-[#07080a] text-fg relative overflow-x-hidden selection:bg-emerald-500/20 flex flex-col md:flex-row">
      {/* Top subtle ambient neo-banking emerald lighting */}
      <div className="pointer-events-none fixed -top-32 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-b from-emerald-500/10 via-emerald-900/5 to-transparent blur-3xl z-0" />

      {/* Desktop Sidebar (hidden on mobile) */}
      <DesktopSidebar />

      {/* Main Content Area (offset by fixed sidebar width on desktop) */}
      <div className="flex-1 min-w-0 flex flex-col min-h-dvh relative z-10 md:pl-64">
        <main className="flex-1 pb-28 md:pb-12 mx-auto w-full max-w-[460px] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      {/* Mobile TabBar (hidden on desktop) */}
      <VoiceButton />
      <TabBar />
    </div>
  </>
);
