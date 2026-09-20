import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { bankMeta } from "@/entities/finance/ui/meta";
import { useFinance, type FinancialEvent, type PeriodKey } from "@/entities/finance";
import { AttentionCard } from "@/features/attention/ui/AttentionCard";
import { BankFilter } from "@/features/accounts/ui/BankFilter";
import { EventList } from "@/features/events/ui/EventList";
import { EventSheet } from "@/features/events/ui/EventSheet";
import { ExplainSheet } from "@/features/reconcile/ui/ExplainSheet";
import { ReconcileStrip } from "@/features/reconcile/ui/ReconcileStrip";
import { SpendDonut } from "@/features/reconcile/ui/SpendDonut";
import { money, time } from "@/shared/lib/format";
import { Segmented } from "@/shared/ui/Segmented";
import { cn } from "@/shared/lib/utils";

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
];

export default function HomePage() {
  const { summary, visibleEvents, accounts, period, setPeriod, today, isSyncing } = useFinance();
  const [explainOpen, setExplainOpen] = useState(false);
  const [selected, setSelected] = useState<FinancialEvent | null>(null);

  const recent = useMemo(() => visibleEvents.slice(0, 4), [visibleEvents]);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const owed = useMemo(
    () => visibleEvents.reduce((sum, event) => sum + (event.debtOutstanding ?? 0), 0),
    [visibleEvents]
  );
  const perDay = Math.round(summary.realExpense / (period === "month" ? today.getDate() : 1));

  return (
    <>
      <header className="flex items-center justify-between px-5 pb-4 pt-5 safe-top">
        <span className="text-[14px] font-semibold -tracking-[0.01em]">Честный месяц</span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-faint">
          <span
            className={cn(
              "size-1.5 rounded-full",
              isSyncing ? "animate-pulse bg-brass" : "bg-sage-strong"
            )}
          />
          {isSyncing ? "синхронизация" : `обновлено в ${time(accounts[0].lastSyncAt)}`}
        </span>
      </header>

      <div className="space-y-2.5 px-5">
        <Segmented layoutId="home-period" value={period} onChange={setPeriod} options={PERIODS} />
        <BankFilter />
        <SpendDonut summary={summary} />
        <ReconcileStrip summary={summary} onExplain={() => setExplainOpen(true)} />
      </div>

      <div className="mt-2.5">
        <AttentionCard />
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 px-5">
        <Tile label="Доход" value={money(summary.realIncome)} tone="sage" />
        <Tile label={period === "month" ? "В день" : "Средний чек"} value={money(perDay)} />
        <Tile label="Вам должны" value={money(owed)} tone={owed > 0 ? "brass" : "muted"} />
      </div>

      <section className="mt-2.5 px-5">
        <div className="rounded-3xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12.5px] text-fg-muted">На счетах</p>
              <p className="tnum mt-0.5 text-[20px] font-bold leading-tight">{money(totalBalance)}</p>
            </div>
            <Link to="/accounts" className="flex items-center gap-0.5 pt-0.5 text-[13px] text-fg-muted">
              Все счета
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-2xl bg-raised px-3 py-2.5">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: bankMeta[account.bank]?.color }}
                  />
                  <span className="truncate text-[12px] text-fg-muted">{account.bankName}</span>
                </span>
                <span className="tnum mt-1 block text-[13.5px] font-semibold">
                  {money(account.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-1 flex items-center justify-between px-5">
          <h2 className="text-[15px] font-semibold">Последние события</h2>
          <Link to="/events" className="flex items-center gap-0.5 text-[13px] text-fg-muted">
            Все
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <EventList events={recent} onSelect={setSelected} />
      </section>

      <ExplainSheet open={explainOpen} onClose={() => setExplainOpen(false)} summary={summary} />
      <EventSheet event={selected} onClose={() => setSelected(null)} />
    </>
  );
}

const Tile = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "sage" | "brass" | "muted";
}) => (
  <div className="rounded-2xl border border-line bg-surface px-3 py-3">
    <p className="text-[11.5px] text-fg-faint">{label}</p>
    <p
      className={
        "tnum mt-1 text-[15px] font-semibold " +
        (tone === "sage"
          ? "text-sage-strong"
          : tone === "brass"
            ? "text-brass"
            : tone === "muted"
              ? "text-fg-faint"
              : "")
      }
    >
      {value}
    </p>
  </div>
);
