import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Camera, Check, ChevronRight, ImagePlus, LogOut, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { useAuth } from "@/app/providers/auth/useAuth";
import { useQuery } from "@tanstack/react-query";

import { financeApi, periodRange, useFinance } from "@/entities/finance";
import { bankMeta } from "@/entities/finance/ui/meta";
import { InsightsCard } from "@/features/insights/ui/InsightsCard";
import { resetOnboarding } from "@/features/onboarding/model/storage";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/features/profile/useProfile";
import { money, percent } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

const RING = 116;
const STROKE = 3;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PRESET_AVATARS = [
  { id: "leo", label: "Leo", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo" },
  { id: "alex", label: "Alex", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" },
  { id: "jordan", label: "Jordan", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan" },
  { id: "sam", label: "Sam", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam" },
  { id: "bot", label: "Bot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Finance" },
];

/** Как движок трактует снятие наличных — менять с фронта нельзя */
const CASH_POLICIES: Record<string, string> = {
  expense_on_withdrawal: "Снятие сразу считается тратой",
  transfer_to_cash_wallet: "Снятие — перевод в кошелёк наличных",
};

export default function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { mutate: upload, isPending: isUploading } = useUploadAvatar();
  const { mutate: save, isPending: isSaving } = useUpdateProfile();
  const { accounts, today, summary, cashPolicy, period } = useFinance();

  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [name, setName] = useState("");

  const [localAvatar, setLocalAvatar] = useState<string | null>(() => {
    return typeof window !== "undefined" ? localStorage.getItem("user_avatar_preview") : null;
  });

  const email = profile?.email ?? auth?.user?.email ?? "";
  const displayName = profile?.username || email.split("@")[0] || "Профиль";
  const initials = displayName.slice(0, 1).toUpperCase();

  const currentAvatar = profile?.profilePicUrl || localAvatar;

  // Сколько событий движок собрал без вопросов — считаем по всему периоду
  const range = periodRange(period, today);
  const monthEvents = useQuery({
    queryKey: ["finance", "events", "profile", period, range.from.toDateString()],
    queryFn: () => financeApi.getEvents({ startDate: range.from, endDate: range.to, limit: 200 }),
    staleTime: 60_000,
  });

  const total = monthEvents.data?.total ?? 0;
  const askedCount = (monthEvents.data?.items ?? []).filter(
    (item) => item.status !== "auto"
  ).length;
  const autoShare = total > 0 ? 1 - askedCount / total : 1;
  const daysWithUs = profile?.createdAt
    ? Math.max(1, Math.round((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000))
    : 1;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLocalAvatar(dataUrl);
      localStorage.setItem("user_avatar_preview", dataUrl);
    };
    reader.readAsDataURL(file);

    // Upload to backend/minio
    upload(file);
    setPhotoSheetOpen(false);
    e.target.value = "";
  };

  const handleSelectPreset = (url: string) => {
    setLocalAvatar(url);
    localStorage.setItem("user_avatar_preview", url);
    setPhotoSheetOpen(false);
  };

  const handleRemovePhoto = () => {
    setLocalAvatar(null);
    localStorage.removeItem("user_avatar_preview");
    setPhotoSheetOpen(false);
  };

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
            onClick={() => setPhotoSheetOpen(true)}
            disabled={isUploading}
            aria-label="Сменить фото"
            className="absolute left-1/2 top-1/2 size-[92px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-raised shadow-inner group transition-transform active:scale-95"
          >
            {currentAvatar ? (
              <img src={currentAvatar} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[32px] font-semibold text-fg-muted">
                {initials}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="size-5 text-white" />
            </span>
            {isUploading ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Camera className="size-5 animate-pulse text-white" />
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setPhotoSheetOpen(true)}
            className="absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full border-2 border-ink bg-surface text-fg hover:text-white shadow-md active:scale-95 transition-transform"
          >
            <Camera className="size-3.5 text-sage-strong" />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <span className="mt-3.5 rounded-full border border-sage/25 bg-sage-dim px-3 py-1 text-[11.5px] font-medium text-sage-strong">
          {percent(autoShare)} разобрано без вас
        </span>

        <h1 className="mt-2.5 text-[21px] font-bold -tracking-[0.02em]">{displayName}</h1>
        <p className="mt-0.5 text-[13px] text-fg-faint">{email}</p>

        {/* Buttons: Change photo & Edit name */}
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPhotoSheetOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12.5px] font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg shadow-sm active:scale-95"
          >
            <Camera className="size-3.5 text-sage-strong" />
            Сменить фото
          </button>

          <button
            type="button"
            onClick={() => {
              setName(profile?.username ?? "");
              setEditOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[12.5px] font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg shadow-sm active:scale-95"
          >
            <Pencil className="size-3.5" />
            Имя
          </button>
        </div>
      </section>

      <section className="mt-6 px-5 md:px-0">
        <div className="flex items-stretch rounded-3xl border border-line bg-surface py-4 shadow-sm">
          <Stat label="Шума убрано" value={money(summary.excluded)} />
          <span className="w-px bg-line" />
          <Stat label="Вопросов" value={String(askedCount)} tone={askedCount ? "brass" : "default"} />
          <span className="w-px bg-line" />
          <Stat label="Дней с нами" value={String(daysWithUs)} />
        </div>
      </section>

      <div className="mt-6">
        <InsightsCard />
      </div>

      <section className="mt-5 px-5 md:px-0">
        <h2 className="px-1 pb-2 text-[13px] text-fg-faint">Настройки</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <span className="min-w-0">
              <span className="block text-[14.5px] font-medium">Наличные</span>
              <span className="mt-0.5 block text-[12.5px] text-fg-faint">
                {CASH_POLICIES[cashPolicy] ?? "Правило задаёт движок"}
              </span>
            </span>
            <span className="shrink-0 rounded-full border border-line bg-raised px-3 py-1 text-[12px] text-fg-muted">
              правило движка
            </span>
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
        Palata · данные за сентябрь
      </p>

      {/* Photo change bottom sheet */}
      <BottomSheet open={photoSheetOpen} onClose={() => setPhotoSheetOpen(false)} title="Фото профиля">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              fileRef.current?.click();
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-raised p-3.5 text-left transition-colors hover:border-sage/50"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-sage-dim text-sage-strong">
              <ImagePlus className="size-5" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-fg">Загрузить своё фото</p>
              <p className="text-[12px] text-fg-muted">Выбрать файл из галереи или с устройства</p>
            </div>
          </button>

          <div>
            <p className="text-[12px] font-medium text-fg-muted mb-2 px-1">Готовые стильные аватарки:</p>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.url)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-raised p-2 hover:border-sage/50 transition-all active:scale-95"
                >
                  <img src={preset.url} alt={preset.label} className="size-10 rounded-full object-cover" />
                  <span className="text-[10px] text-fg-muted truncate">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {currentAvatar ? (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 py-3 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/15"
            >
              <Trash2 className="size-4" />
              Удалить фото
            </button>
          ) : null}
        </div>
      </BottomSheet>

      {/* Name edit bottom sheet */}
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
