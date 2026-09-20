import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Camera, Check, ChevronRight, LogOut, Pencil, RotateCcw } from "lucide-react";

import { useAuth } from "@/app/providers/auth/useAuth";
import { eventsInPeriod, useFinance } from "@/entities/finance";
import { bankMeta } from "@/entities/finance/ui/meta";
import { resetOnboarding } from "@/features/onboarding/model/storage";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/features/profile/useProfile";
import { money, percent } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

const RING = 116;
const STROKE = 3;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
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
      <div className="flex justify-end px-4 safe-top">
        <button
          type="button"
          onClick={() => auth?.logout()}
          aria-label="Выйти"
          title="Выйти"
          className="rounded-full border border-line bg-surface p-2.5 text-fg-muted transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>

      <section className="flex flex-col items-center px-5 pb-1 pt-3">
        <div className="relative" style={{ width: RING, height: RING }}>
          {/* Кольцо показывает, какую долю месяца движок разобрал без вопросов */}
          <svg width={RING} height={RING} className="-rotate-90" aria-hidden>
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-line-strong)"
              strokeWidth={STROKE}
            />
            <motion.circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-sage)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - autoShare) }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            aria-label="Сменить фото"
            className="absolute left-1/2 top-1/2 size-[92px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-raised"
          >
            {profile?.profilePicUrl ? (
              <img src={profile.profilePicUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[32px] font-semibold text-fg-muted">
                {initials}
              </span>
            )}
            {isUploading ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55">
                <Camera className="size-5 animate-pulse text-white" />
              </span>
            ) : null}
          </button>

          <span className="pointer-events-none absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full border-2 border-ink bg-raised text-fg-muted">
            <Camera className="size-3.5" />
          </span>
        </div>

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

        <span className="mt-3.5 rounded-full border border-sage/25 bg-sage-dim px-3 py-1 text-[11.5px] font-medium text-sage-strong">
          {percent(autoShare)} разобрано без вас
        </span>

        <h1 className="mt-2.5 text-[21px] font-bold -tracking-[0.02em]">{displayName}</h1>
        <p className="mt-0.5 text-[13px] text-fg-faint">{email}</p>

        <button
          type="button"
          onClick={() => {
            setName(profile?.username ?? "");
            setEditOpen(true);
          }}
          className="mt-3 flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] text-fg-muted transition-colors hover:text-fg"
        >
          <Pencil className="size-3.5" />
          Изменить имя
        </button>
      </section>

      <section className="mt-6 px-5">
        <div className="flex items-stretch rounded-3xl border border-line bg-surface py-4">
          <Stat label="Шума убрано" value={money(summary.excluded)} />
          <span className="w-px bg-line" />
          <Stat label="Вопросов" value={String(askedCount)} tone={askedCount ? "brass" : "default"} />
          <span className="w-px bg-line" />
          <Stat label="Дней с нами" value={String(daysWithUs)} />
        </div>
      </section>

      <section className="mt-5 px-5">
        <h2 className="px-1 pb-2 text-[13px] text-fg-faint">Настройки</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium">Наличные — это трата</span>
              <span className="mt-0.5 block text-[12.5px] text-fg-faint">
                Снятия в банкомате попадают в расходы
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={cashAsExpense}
              aria-label="Считать наличные тратой"
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
            className="flex items-center justify-between border-t border-line px-4 py-4 transition-colors hover:bg-raised/50"
          >
            <span>
              <span className="block text-[14.5px] font-medium">Подключённые банки</span>
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
            onClick={() => {
              resetOnboarding(email);
              navigate("/onboarding");
            }}
            className="flex w-full items-center justify-between border-t border-line px-4 py-4 text-left transition-colors hover:bg-raised/50"
          >
            <span>
              <span className="block text-[14.5px] font-medium">Загрузить новую выписку</span>
              <span className="mt-0.5 block text-[12.5px] text-fg-faint">Пройти разбор заново</span>
            </span>
            <RotateCcw className="size-4 text-fg-faint" />
          </button>
        </div>
      </section>

      <p className="mt-6 px-6 text-center text-[11.5px] text-fg-faint">
        Честный месяц · данные за сентябрь
      </p>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Как вас зовут">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Имя"
          autoFocus
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
  tone?: "default" | "brass";
}) => (
  <div className="flex flex-1 flex-col items-center px-2 text-center">
    <span className={cn("tnum text-[17px] font-bold", tone === "brass" && "text-brass")}>{value}</span>
    <span className="mt-0.5 text-[11.5px] leading-tight text-fg-faint">{label}</span>
  </div>
);
