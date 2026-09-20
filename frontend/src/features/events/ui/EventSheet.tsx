import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";

import { financeApi, useFinance, type FinancialEvent } from "@/entities/finance";
import { dayMonth, money, time } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

import { MoneyGraph } from "./MoneyGraph";

type EventSheetProps = {
  event: FinancialEvent | null;
  onClose: () => void;
};

export const EventSheet = ({ event, onClose }: EventSheetProps) => {
  const { resolve, resolveCustom, accounts, withAttention } = useFinance();
  const [draft, setDraft] = useState("");

  /** Новый вопрос — чистое поле */
  useEffect(() => setDraft(""), [event?.id]);

  const detail = useQuery({
    queryKey: ["finance", "event", event?.id],
    queryFn: () => financeApi.getEventDetail(event!.id),
    enabled: Boolean(event?.id),
    staleTime: 30_000,
  });

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((account) => [account.id, account.bankName]));
    return (id: string) => map.get(id) ?? "Счёт";
  }, [accounts]);

  if (!event) return <BottomSheet open={false} onClose={onClose} />;

  /** Вопрос и варианты приходят отдельным запросом — добираем их здесь */
  const current = withAttention(event);
  const attention = current.status === "needs_attention";
  const transactions = detail.data?.transactions ?? [];
  const hasGraph = transactions.length > 1;

  /** Сначала факт — что за операция, от кого и на сколько, — и только потом вопрос */
  const operations = hasGraph ? null : (
    <div>
      <p className="px-1 pb-2 text-[12.5px] text-fg-faint">
        {attention ? "Что за операция" : "Операции банка"}
      </p>
      <ul className="overflow-hidden rounded-2xl border border-line">
        {transactions.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center justify-between gap-3 bg-raised px-4 py-3",
              index > 0 && "border-t border-line"
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-[13.5px]">
                {item.merchant ?? item.counterparty ?? item.description}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-fg-faint">
                {accountName(item.account_id)} · {dayMonth(item.occurred_at)}, {time(item.occurred_at)}
              </span>
              {item.description && item.description !== item.merchant ? (
                <span className="mt-0.5 block truncate text-[11.5px] text-fg-faint">
                  «{item.description}»
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "tnum shrink-0 text-[15px]",
                item.amount_minor > 0 ? "text-sage-strong" : "text-fg"
              )}
            >
              {money(item.amount_minor / 100, { sign: true })}
            </span>
          </li>
        ))}
        {detail.isLoading ? (
          <li className="bg-raised px-4 py-4 text-[13px] text-fg-faint">Загружаем операции…</li>
        ) : null}
      </ul>
    </div>
  );

  return (
    <BottomSheet open onClose={onClose} title={event.title}>
      <div className="space-y-4">
        {attention ? operations : null}

        {attention && current.options?.length ? (
          <div className="overflow-hidden rounded-2xl border border-sage/40 bg-gradient-to-b from-sage-dim to-raised p-4">
            <span className="flex items-center gap-2 text-[12.5px] text-sage-strong">
              <span className="size-1.5 rounded-full bg-sage-strong" />
              Нужно решить
            </span>

            <p className="mt-2.5 text-[17px] font-semibold leading-snug">{current.question}</p>
            {current.reason ? <p className="mt-1 text-[13px] text-fg-muted">{current.reason}</p> : null}

            <div className="no-scrollbar mt-3.5 flex gap-2 overflow-x-auto">
              {current.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    resolve(event.id, option.id);
                    onClose();
                  }}
                  className="max-w-[62%] shrink-0 truncate rounded-full border border-line-strong bg-surface px-3.5 py-2.5 text-[13px] font-medium transition-colors hover:border-sage hover:text-sage-strong"
                >
                  {option.label}
                </button>
              ))}
            </div>

            <form
              className="mt-3 flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-sage/60"
              onSubmit={(submitEvent) => {
                submitEvent.preventDefault();
                if (!draft.trim()) return;
                resolveCustom(event.id, draft);
                onClose();
              }}
            >
              <input
                value={draft}
                onChange={(changeEvent) => setDraft(changeEvent.target.value)}
                placeholder="Свой вариант"
                enterKeyHint="done"
                aria-label="Свой вариант ответа"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-faint"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Сохранить свой вариант"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-sage text-ink transition-opacity disabled:bg-line-strong disabled:text-fg-faint disabled:opacity-60"
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-raised p-4">
            <p className="text-[13px] text-fg-muted">
              {event.effectiveIncome > 0 ? "Реальный доход" : "Реальная трата"}
            </p>
            <p className="tnum mt-1 text-[30px] font-bold leading-none">
              {money(event.effectiveIncome > 0 ? event.effectiveIncome : event.effectiveExpense)}
            </p>
            {event.reason ? <p className="mt-2.5 text-[13.5px] text-fg-muted">{event.reason}</p> : null}
          </div>
        )}

        {hasGraph ? (
          <MoneyGraph
            transactions={transactions}
            result={event.effectiveIncome > 0 ? event.effectiveIncome : event.effectiveExpense}
            resultLabel={event.effectiveIncome > 0 ? "Реальный доход" : "Реальная трата"}
          />
        ) : null}

        {event.debtOutstanding ? (
          <div className="flex items-center justify-between rounded-2xl border border-line bg-raised px-4 py-3.5">
            <span className="text-[13.5px] text-fg-muted">Ещё не вернули</span>
            <span className="tnum text-[15px] text-brass">{money(event.debtOutstanding)}</span>
          </div>
        ) : null}

        {attention ? null : operations}
      </div>
    </BottomSheet>
  );
};
