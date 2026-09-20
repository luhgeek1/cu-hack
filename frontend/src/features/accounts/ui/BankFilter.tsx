import { bankMeta } from "@/entities/finance/ui/meta";
import { useFinance, type BankFilter as BankFilterValue } from "@/entities/finance";
import { cn } from "@/shared/lib/utils";

const ORDER: BankFilterValue[] = ["all", "tbank", "sber", "alfa", "ozon"];

/** Фильтр по счёту: все банки или один конкретный */
export const BankFilter = () => {
  const { bank, setBank } = useFinance();

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ORDER.map((id) => {
        const active = bank === id;
        const meta = id === "all" ? null : bankMeta[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => setBank(id)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] transition-colors",
              active
                ? "border-line-strong bg-raised font-medium text-fg"
                : "border-line bg-surface text-fg-muted hover:text-fg"
            )}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: meta?.color ?? "var(--color-sage-strong)" }}
            />
            <span className="truncate">{meta?.name ?? "Все"}</span>
          </button>
        );
      })}
    </div>
  );
};
