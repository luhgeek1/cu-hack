import { X } from "lucide-react";

import { useFinance } from "@/entities/finance";
import { bankMeta } from "@/entities/finance/ui/meta";

/** Напоминание, что данные отфильтрованы по одному банку */
export const ActiveBankChip = () => {
  const { bank, setBank } = useFinance();
  if (bank === "all") return null;

  const meta = bankMeta[bank];

  return (
    <button
      type="button"
      onClick={() => setBank("all")}
      className="flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[12px] text-fg-muted"
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta?.color }} />
      {meta?.name}
      <X className="size-3" />
    </button>
  );
};
