import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Check, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { financeApi, useFinance } from "@/entities/finance";
import { bankMeta } from "@/entities/finance/ui/meta";
import { TotalBalanceCard } from "@/features/finance/ui/TotalBalanceCard";
import { money, time } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";


export default function AccountsPage() {
  const { accounts, today, isSyncing, refresh } = useFinance();
  const queryClient = useQueryClient();

  const banks = useQuery({
    queryKey: ["finance", "banks"],
    queryFn: financeApi.getBanks,
    staleTime: 60_000,
  });

  const connect = useMutation({
    mutationFn: (provider: string) => financeApi.connectBank(provider, today),
    onSuccess: (result) => {
      toast.success(`Импортировано операций: ${result.imported_count}`);
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setSheetOpen(false);
      setConnecting(null);
    },
    onError: () => {
      toast.error("Не удалось подключить банк");
      setConnecting(null);
    },
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const total = accounts.reduce((sum, account) => sum + account.balance, 0);

  const handleConnect = (provider: string) => {
    setConnecting(provider);
    connect.mutate(provider);
  };

  return (
    <>
      <header className="px-5 md:px-0 pb-4 pt-5 safe-top flex items-center justify-between">
        <h1 className="text-[22px] md:text-[26px] font-bold -tracking-[0.02em]">Счета</h1>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="hidden sm:flex items-center gap-2 rounded-2xl bg-sage px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
        >
          <Plus className="size-4" />
          Подключить банк
        </button>
      </header>

      <section className="px-5 md:px-0">
        <TotalBalanceCard accounts={accounts} totalBalance={total} />
      </section>

      <div className="mt-4 px-5 md:px-0">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-fg-muted mb-2 px-1">
          Все подключенные счета ({accounts.length})
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((account) => {
            const meta = bankMeta[account.bank];
            return (
              <li
                key={account.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-xs hover:border-line-strong transition-colors"
              >
                {meta ? (
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold"
                    style={{ backgroundColor: meta.color, color: meta.ink }}
                  >
                    {meta.short}
                  </span>
                ) : (
                  /* Наличные и прочие небанковские счета: купюры вместо буквы банка */
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-raised text-fg-muted">
                    <Banknote className="size-5" strokeWidth={1.8} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{account.bankName}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-faint">
                    <span>{account.mask}</span>
                    <span>·</span>
                    <span>{account.name}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-[15px] font-bold">{money(account.balance)}</span>
                  <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-sage-strong">
                    <Check className="size-3" />
                    <span>активен</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 px-5 md:px-0 sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sage px-4 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
        >
          <Plus className="size-4" />
          Подключить банк
        </button>
      </div>

      <p className="mt-3 px-6 text-center text-[12px] text-fg-faint">
        Выписки обновляются сами · доступ только на чтение
      </p>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Подключить банк">
        <ul className="space-y-2">
          {(banks.data ?? []).map((bank) => {
            const connected = bank.connected;
            const busy = connecting === bank.code;
            return (
              <li key={bank.code}>
                <button
                  type="button"
                  disabled={connected || busy}
                  onClick={() => handleConnect(bank.code)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors",
                    connected ? "border-sage/40 bg-sage-dim" : "border-line bg-raised hover:border-line-strong"
                  )}
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold text-white"
                    style={{ backgroundColor: bankMeta[bank.code]?.color ?? "var(--color-raised)" }}
                  >
                    {bank.name.slice(0, 1)}
                  </span>
                  <span className="flex-1 text-[14.5px] font-medium">{bank.name}</span>
                  <AnimatePresence mode="wait">
                    {connected ? (
                      <motion.span key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <Check className="size-4 text-sage-strong" />
                      </motion.span>
                    ) : busy ? (
                      <motion.span
                        key="busy"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <RefreshCw className="size-4 text-fg-muted" />
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
