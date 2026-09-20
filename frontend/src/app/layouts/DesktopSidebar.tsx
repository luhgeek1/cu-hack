import { NavLink } from "react-router-dom";
import {
  ChartNoAxesColumn,
  ChevronRight,
  Landmark,
  Layers,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";

import { useFinance } from "@/entities/finance";
import { useAuth } from "@/app/providers/auth/useAuth";
import { useProfile } from "@/features/profile/useProfile";
import { time } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Главная", icon: Wallet, end: true },
  { to: "/events", label: "События", icon: Layers, end: false, hasBadge: true },
  { to: "/analytics", label: "Аналитика", icon: ChartNoAxesColumn, end: false },
  { to: "/accounts", label: "Счета", icon: Landmark, end: false },
  { to: "/profile", label: "Профиль", icon: User, end: false },
];

export const DesktopSidebar = () => {
  const { needsAttention, isSyncing, accounts } = useFinance();
  const { data: profile } = useProfile();
  const auth = useAuth();

  const name = profile?.username || profile?.email || auth?.user?.name || "Пользователь";
  const email = profile?.email || auth?.user?.email || "";
  const initials = name
    .split(/[\s@._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const localAvatar =
    typeof window !== "undefined" ? localStorage.getItem("user_avatar_preview") : null;
  const avatarUrl = profile?.profilePicUrl || localAvatar;

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-line bg-[#0d0f12]/90 backdrop-blur-xl p-5 sticky top-0 h-screen z-30">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-black shadow-lg shadow-emerald-500/20 font-bold">
            <Sparkles className="size-5 text-black" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-fg">Честный месяц</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isSyncing ? "bg-brass animate-pulse" : "bg-emerald-400"
                )}
              />
              <span className="text-[11px] text-fg-faint">
                {isSyncing ? "синхронизация" : `онлайн · ${accounts[0]?.lastSyncAt ? time(accounts[0].lastSyncAt) : "сейчас"}`}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const badgeCount = item.hasBadge ? needsAttention.length : 0;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between rounded-2xl px-3.5 py-3 text-[13.5px] font-medium transition-all group",
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs"
                      : "text-fg-muted hover:bg-raised/70 hover:text-fg border border-transparent"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "size-[18px] transition-colors",
                          isActive ? "text-emerald-400" : "text-fg-faint group-hover:text-fg"
                        )}
                        strokeWidth={1.9}
                      />
                      <span>{item.label}</span>
                    </div>

                    {badgeCount > 0 ? (
                      <span className="flex items-center justify-center rounded-full bg-emerald-500 text-black font-bold text-[10.5px] px-2 py-0.5 shadow-sm animate-pulse">
                        {badgeCount}
                      </span>
                    ) : (
                      <ChevronRight
                        className={cn(
                          "size-3.5 transition-transform opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 text-fg-faint",
                          isActive && "opacity-60 text-emerald-400"
                        )}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Mini Profile Footer */}
      <div className="border-t border-line pt-4">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-raised/80 group"
        >
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-line-strong bg-raised flex items-center justify-center text-[13px] font-bold text-fg-muted group-hover:border-emerald-500/50 transition-colors">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : initials ? (
              initials
            ) : (
              <User className="size-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-fg group-hover:text-emerald-300 transition-colors">
              {name}
            </p>
            <p className="truncate text-[11px] text-fg-faint">{email || "Настройки аккаунта"}</p>
          </div>

          <ChevronRight className="size-4 text-fg-faint group-hover:text-fg group-hover:translate-x-0.5 transition-all" />
        </NavLink>
      </div>
    </aside>
  );
};
