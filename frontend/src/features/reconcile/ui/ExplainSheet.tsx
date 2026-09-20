import type { PeriodSummary } from "@/entities/finance";
import { money } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";

type ExplainSheetProps = {
  open: boolean;
  onClose: () => void;
  summary: PeriodSummary;
};

export const ExplainSheet = ({ open, onClose, summary }: ExplainSheetProps) => (
  <BottomSheet open={open} onClose={onClose} title={`Откуда ${money(summary.realExpense)}`}>
    <div className="rounded-2xl border border-line bg-raised px-4">
      <div className="flex items-center justify-between py-3.5">
        <span className="text-[14px] text-fg-muted">Банк списал</span>
        <span className="tnum text-[15px]">{money(summary.bankSpent)}</span>
      </div>

      {summary.excludedBreakdown.map((row) => (
        <div key={row.type} className="flex items-center justify-between border-t border-line py-3.5">
          <span className="max-w-[62%] text-[14px] text-fg-muted">{row.label}</span>
          <span className="tnum text-[15px] text-fg-muted">{money(-row.amount)}</span>
        </div>
      ))}

      <div className="flex items-center justify-between border-t border-line-strong py-4">
        <span className="text-[14px] font-medium">Ваши траты</span>
        <span className="tnum text-[17px] font-semibold text-sage-strong">{money(summary.realExpense)}</span>
      </div>
    </div>
  </BottomSheet>
);
