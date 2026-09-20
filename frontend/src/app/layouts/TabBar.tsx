import { NavLink } from "react-router-dom";
import { ChartNoAxesColumn, Landmark, Layers, User, Wallet } from "lucide-react";

import { useFinance } from "@/entities/finance";
import { useProfile } from "@/features/profile/useProfile";
import { cn } from "@/shared/lib/utils";

const left = [
  { to: "/", label: "Главное", icon: Wallet, end: true },
  { to: "/events", label: "События", icon: Layers, end: false },
];

const right = [
  { to: "/analytics", label: "Аналитика", icon: ChartNoAxesColumn, end: false },
  { to: "/accounts", label: "Счета", icon: Landmark, end: false },
];

export const TabBar = () => {
  const { needsAttention } = useFinance();
  const { data: profile } = useProfile();

  const name = profile?.username || profile?.email || "";
  const initials = name.split(/[\s@._-]+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden">
      <div className="pointer-events-auto mx-auto w-full max-w-[460px] border-t border-line bg-surface/95 px-2 pt-1.5 backdrop-blur-xl safe-bottom">
        <ul className="flex items-stretch">
          {left.map((tab) => (
            <Tab key={tab.to} tab={tab} badge={tab.to === "/events" && needsAttention.length > 0} />
          ))}

          <li className="flex-1">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] transition-colors",
                  isActive ? "text-fg" : "text-fg-faint hover:text-fg-muted"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex size-[26px] items-center justify-center overflow-hidden rounded-full border text-[10.5px] font-semibold transition-colors",
                      isActive
                        ? "border-sage-strong bg-sage-dim text-sage-strong"
                        : "border-line-strong bg-raised text-fg-muted"
                    )}
                  >
                    {(() => {
                      const localAvatar = typeof window !== "undefined" ? localStorage.getItem("user_avatar_preview") : null;
                      const avatarUrl = profile?.profilePicUrl || localAvatar;
                      if (avatarUrl) {
                        return <img src={avatarUrl} alt="" className="size-full object-cover" />;
                      }
                      if (initials) return initials;
                      return <User className="size-[15px]" strokeWidth={1.8} />;
                    })()}
                  </span>
                  Профиль
                </>
              )}
            </NavLink>
          </li>

          {right.map((tab) => (
            <Tab key={tab.to} tab={tab} badge={false} />
          ))}
        </ul>
      </div>
    </nav>
  );
};

type TabProps = {
  tab: { to: string; label: string; icon: typeof Wallet; end: boolean };
  badge: boolean;
};

const Tab = ({ tab, badge }: TabProps) => (
  <li className="flex-1">
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] transition-colors",
          isActive ? "text-fg" : "text-fg-faint hover:text-fg-muted"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <tab.icon className={cn("size-[22px]", isActive && "text-sage-strong")} strokeWidth={isActive ? 2 : 1.6} />
            {badge ? (
              <span className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-brass ring-2 ring-surface" />
            ) : null}
          </span>
          {tab.label}
        </>
      )}
    </NavLink>
  </li>
);
