import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, ChevronRight, LogOut, Pencil } from "lucide-react";

import { useAuth } from "@/app/providers/auth/useAuth";
import { eventsInPeriod, useFinance } from "@/entities/finance";
import { bankMeta } from "@/entities/finance/ui/meta";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/features/profile/useProfile";
import { money, percent } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

export default function ProfilePage() {
  const auth = useAuth();
  const { data: profile } = useProfile();
  const { mutate: upload, isPending: isUploading } = useUploadAvatar();
  const { mutate: save, isPending: isSaving } = useUpdateProfile();
  const { events, accounts, today, summary, cashAsExpense, setCashAsExpense } = useFinance();

  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");

  const email = profile?.email ?? auth?.user?.email ?? "";
  const displayName = profile?.username || email.split("@")[0] || "Профиль";
  const initials = displayName.slice(0, 1).toUpperCase();

  const monthEvents = eventsInPeriod(events, "month", today);
  const askedCount = monthEvents.filter(
    (event) => event.status === "needs_attention" || event.status === "confirmed"
  ).length;
  const autoShare = monthEvents.length > 0 ? 1 - askedCount / monthEvents.length : 1;
  const daysWithUs = profile?.createdAt
    ? Math.max(1, Math.round((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000))
    : 1;

  return (
    <>
      <header className="px-5 pb-4 pt-5 safe-top">
        <h1 className="text-[22px] font-bold -tracking-[0.02em]">Профиль</h1>
      </header>

      <section className="px-5">
        <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="group relative size-16 shrink-0 overflow-hidden rounded-full border border-line-strong bg-raised"
          >
            {profile?.profilePicUrl ? (
              <img src={profile.profilePicUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[22px] font-semibold text-fg-muted">
                {initials}
              </span>
            )}
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-black/55 transition-opacity",
                isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <Camera className="size-5 text-white" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold">{displayName}</p>
            <p className="mt-0.5 truncate text-[13px] text-fg-faint">{email}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setName(profile?.username ?? "");
              setEditOpen(true);
            }}
            aria-label="Изменить имя"
            className="rounded-full border border-line bg-raised p-2.5 text-fg-muted transition-colors hover:text-fg"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </section>

      <section className="mt-2.5 grid grid-cols-2 gap-2 px-5">
        <Stat label="Разобрано без вас" value={percent(autoShare)} tone="sage" />
        <Stat label="Шума убрано" value={money(summary.excluded)} />
        <Stat label="Вопросов за месяц" value={String(askedCount)} tone={askedCount ? "brass" : "muted"} />
        <Stat label="Дней с нами" value={String(daysWithUs)} />
      </section>

      <section className="mt-5 px-5">
        <h2 className="pb-2 text-[15px] font-semibold">Настройки</h2>
        <div className="rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <span className="min-w-0">
              <span className="block text-[14px] font-medium">Наличные — это трата</span>
              <span className="mt-0.5 block text-[12.5px] text-fg-faint">
                Снятия в банкомате попадают в расходы
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={cashAsExpense}
              onClick={() => setCashAsExpense(!cashAsExpense)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                cashAsExpense ? "bg-sage" : "bg-line-strong"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 size-5 rounded-full bg-white transition-all",
                  cashAsExpense ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>

          <Link
            to="/accounts"
            className="flex items-center justify-between border-t border-line px-4 py-4"
          >
            <span>
              <span className="block text-[14px] font-medium">Подключённые банки</span>
              <span className="mt-1 flex items-center gap-1">
                {accounts.map((account) => (
                  <span
                    key={account.id}
                    className="size-2 rounded-full"
                    style={{ backgroundColor: bankMeta[account.bank]?.color }}
                  />
                ))}
                <span className="ml-1 text-[12.5px] text-fg-faint">{accounts.length} счёта</span>
              </span>
            </span>
            <ChevronRight className="size-4 text-fg-faint" />
          </Link>

          <button
            type="button"
            onClick={() => auth?.logout()}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-4 text-[14px] text-fg-muted transition-colors hover:text-destructive"
          >
            <LogOut className="size-4" />
            Выйти
          </button>
        </div>
      </section>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Как вас зовут">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Имя"
          className="w-full rounded-2xl border border-line bg-raised px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-fg-faint focus:border-sage"
        />
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            save({ username: name.trim() || null });
            setEditOpen(false);
          }}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-sage px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          <Check className="size-4" />
          Сохранить
        </button>
      </BottomSheet>
    </>
  );
}

const Stat = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "sage" | "brass" | "muted";
}) => (
  <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
    <p className="text-[11.5px] text-fg-faint">{label}</p>
    <p
      className={cn(
        "tnum mt-1 text-[19px] font-bold",
        tone === "sage" && "text-sage-strong",
        tone === "brass" && "text-brass",
        tone === "muted" && "text-fg-faint"
      )}
    >
      {value}
    </p>
  </div>
);
