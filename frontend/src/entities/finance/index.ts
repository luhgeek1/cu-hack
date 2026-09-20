import { eventsInPeriod, summarize } from "./model/analytics";
import { demoToday, initialEvents } from "./model/dataset";

export * from "./model/types";
export * from "./model/analytics";
export { FinanceProvider, useFinance } from "./model/store";
export { accounts, accountsById, allTransactions, demoToday, transactionsById } from "./model/dataset";

/** Итоги демо-месяца — нужны до входа, когда провайдера ещё нет */
export const demoSummary = summarize(initialEvents, "month", demoToday);

/** Сводка первичного разбора — показываем в конце онбординга */
const demoMonthEvents = eventsInPeriod(initialEvents, "month", demoToday);

export const demoIntake = {
  events: demoMonthEvents.length,
  transactions: demoMonthEvents.reduce((sum, event) => sum + event.transactionIds.length, 0),
  needsAttention: demoMonthEvents.filter((event) => event.status === "needs_attention").length,
};
