import { summarize } from "./model/analytics";
import { demoToday, initialEvents } from "./model/dataset";

export * from "./model/types";
export * from "./model/analytics";
export { FinanceProvider, useFinance } from "./model/store";
export { accounts, accountsById, allTransactions, demoToday, transactionsById } from "./model/dataset";

/** Итоги демо-месяца — нужны до входа, когда провайдера ещё нет */
export const demoSummary = summarize(initialEvents, "month", demoToday);
