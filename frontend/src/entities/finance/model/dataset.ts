import type {
  Account,
  Category,
  EventStatus,
  EventType,
  FinancialEvent,
  ResolutionOption,
  Transaction,
} from "./types";

/**
 * Демо-данные «Честного месяца».
 *
 * Сентябрь 2026 собран вручную: в нём лежат все сценарии из кейса
 * (свой перевод, маркетплейс-карта, долг с частичными возвратами,
 * общий счёт, возврат товара, снятие наличных, непонятный входящий).
 * Январь–август генерируются детерминированно — нужны для года и сравнений.
 *
 * Арифметика нигде не хардкодится: суммы событий считаются из транзакций.
 */

export const accounts: Account[] = [
  {
    id: "acc_tbank",
    bank: "tbank",
    bankName: "Т-Банк",
    name: "Дебетовая",
    mask: "•• 4417",
    currency: "RUB",
    balance: 84_320,
    lastSyncAt: "2026-09-20T09:12:00",
  },
  {
    id: "acc_sber",
    bank: "sber",
    bankName: "Сбер",
    name: "Накопительный",
    mask: "•• 9082",
    currency: "RUB",
    balance: 212_500,
    lastSyncAt: "2026-09-20T09:12:00",
  },
  {
    id: "acc_alfa",
    bank: "alfa",
    bankName: "Альфа",
    name: "Зарплатная",
    mask: "•• 1130",
    currency: "RUB",
    balance: 31_640,
    lastSyncAt: "2026-09-20T09:11:00",
  },
  {
    id: "acc_ozon",
    bank: "ozon",
    bankName: "Ozon Банк",
    name: "Ozon Карта",
    mask: "•• 7741",
    currency: "RUB",
    balance: 600,
    lastSyncAt: "2026-09-20T09:12:00",
  },
];

const transactions: Transaction[] = [];
let txSeq = 0;

const tx = (
  accountId: string,
  direction: "debit" | "credit",
  amount: number,
  timestamp: string,
  merchant?: string,
  description?: string
): Transaction => {
  const item: Transaction = {
    id: `tx_${String(++txSeq).padStart(3, "0")}`,
    accountId,
    amount,
    direction,
    timestamp,
    merchant,
    description,
  };
  transactions.push(item);
  return item;
};

type EventInput = {
  type: EventType;
  title: string;
  subtitle?: string;
  category?: Category;
  confidence: number;
  status?: EventStatus;
  reason?: string;
  question?: string;
  options?: ResolutionOption[];
  debtOutstanding?: number;
  policyKey?: "cash";
  expense: number;
  income: number;
  tx: Transaction[];
};

let evSeq = 0;

const ev = (input: EventInput): FinancialEvent => {
  const gross = input.tx.reduce(
    (sum, t) => (t.direction === "debit" ? sum + t.amount : sum),
    0
  );
  const timestamp = input.tx
    .map((t) => t.timestamp)
    .sort()
    .slice(-1)[0];

  return {
    id: `ev_${String(++evSeq).padStart(3, "0")}`,
    type: input.type,
    title: input.title,
    subtitle: input.subtitle,
    category: input.category,
    amount: gross || input.tx.reduce((s, t) => s + t.amount, 0),
    effectiveExpense: input.expense,
    effectiveIncome: input.income,
    confidence: input.confidence,
    status: input.status ?? "auto",
    timestamp,
    transactionIds: input.tx.map((t) => t.id),
    reason: input.reason,
    policyKey: input.policyKey,
    question: input.question,
    options: input.options,
    debtOutstanding: input.debtOutstanding,
  };
};

/** Обычная покупка — самый частый случай, поэтому отдельный помощник */
const purchase = (
  merchant: string,
  amount: number,
  timestamp: string,
  category: Category,
  accountId = "acc_tbank"
) =>
  ev({
    type: "EXPENSE",
    title: merchant,
    category,
    confidence: 0.99,
    expense: amount,
    income: 0,
    tx: [tx(accountId, "debit", amount, timestamp, merchant)],
  });

// ── Сентябрь 2026 ────────────────────────────────────────────────────────

const september: FinancialEvent[] = [
  ev({
    type: "INCOME",
    title: "Зарплата",
    subtitle: "Альфа-Банк",
    confidence: 0.99,
    expense: 0,
    income: 185_000,
    tx: [tx("acc_alfa", "credit", 185_000, "2026-09-01T10:04:00", "ООО Технологии", "Заработная плата")],
  }),

  purchase("Пятёрочка", 2_340, "2026-09-02T19:24:00", "Продукты"),
  purchase("Яндекс Go", 420, "2026-09-02T09:11:00", "Транспорт"),
  purchase("Кофе Правда", 380, "2026-09-03T08:47:00", "Кафе"),

  ev({
    type: "OWN_TRANSFER",
    title: "Т-Банк → Сбер",
    subtitle: "Перевод между своими счетами",
    confidence: 0.99,
    expense: 0,
    income: 0,
    reason: "Одинаковая сумма, разница 12 секунд, оба счёта ваши",
    tx: [
      tx("acc_tbank", "debit", 10_000, "2026-09-03T12:30:00", "Перевод", "На накопительный"),
      tx("acc_sber", "credit", 10_000, "2026-09-03T12:30:12", "Перевод", "С карты Т-Банк"),
    ],
  }),

  purchase("Самокат", 1_870, "2026-09-04T20:02:00", "Продукты"),
  purchase("Яндекс Плюс", 399, "2026-09-04T03:00:00", "Подписки"),

  ev({
    type: "MARKETPLACE_TRANSFER",
    title: "Пополнение Ozon Карты",
    subtitle: "Т-Банк → Ozon Банк",
    confidence: 0.97,
    expense: 0,
    income: 0,
    reason: "Деньги остались у вас — тратой станут покупки с этой карты",
    tx: [
      tx("acc_tbank", "debit", 6_000, "2026-09-05T11:15:00", "Ozon Банк", "Пополнение"),
      tx("acc_ozon", "credit", 6_000, "2026-09-05T11:15:04", "Пополнение", "С карты Т-Банк"),
    ],
  }),

  purchase("Ozon · наушники", 2_290, "2026-09-05T12:40:00", "Дом", "acc_ozon"),
  purchase("Ozon · бытовая химия", 870, "2026-09-06T14:22:00", "Дом", "acc_ozon"),
  purchase("Ozon · продукты", 1_240, "2026-09-06T14:30:00", "Продукты", "acc_ozon"),
  purchase("Азбука вкуса", 1_560, "2026-09-06T19:55:00", "Продукты"),

  ev({
    type: "SHARED_EXPENSE",
    title: "Северяне",
    subtitle: "Ужин на четверых",
    category: "Кафе",
    confidence: 0.93,
    expense: 2_100,
    income: 0,
    reason: "Счёт на четверых — трое вернули свои доли",
    tx: [
      tx("acc_tbank", "debit", 8_400, "2026-09-07T21:40:00", "Ресторан Северяне"),
      tx("acc_tbank", "credit", 2_100, "2026-09-07T22:05:00", "Антон К.", "за ужин"),
      tx("acc_tbank", "credit", 2_100, "2026-09-08T10:12:00", "Михаил Р.", "рестик"),
      tx("acc_tbank", "credit", 2_100, "2026-09-09T13:48:00", "Екатерина В.", "за вчера"),
    ],
  }),

  ev({
    type: "DEBT_GIVEN",
    title: "Антон К.",
    subtitle: "Вернул 10 000 из 12 000 ₽",
    confidence: 0.96,
    expense: 0,
    income: 0,
    debtOutstanding: 2_000,
    reason: "Перевод человеку и встречные возвраты — деньги не потрачены",
    tx: [
      tx("acc_tbank", "debit", 12_000, "2026-09-08T18:30:00", "Антон К.", "в долг до зарплаты"),
      tx("acc_tbank", "credit", 6_000, "2026-09-12T11:20:00", "Антон К.", "долг 1/2"),
      tx("acc_tbank", "credit", 4_000, "2026-09-18T17:05:00", "Антон К.", "остаток позже"),
    ],
  }),

  ev({
    type: "CASH_WITHDRAWAL",
    policyKey: "cash",
    title: "Снятие наличных",
    subtitle: "Банкомат Т-Банк",
    category: "Наличные",
    confidence: 0.68,
    status: "needs_attention",
    question: "Считать снятые 7 000 ₽ тратой?",
    reason: "Наличные мы не видим — решение за вами",
    options: [
      {
        id: "spent",
        label: "Уже потратил",
        type: "CASH_WITHDRAWAL",
        effectiveExpense: 7_000,
        effectiveIncome: 0,
        hint: "Попадёт в траты сентября",
      },
      {
        id: "wallet",
        label: "Лежат в кошельке",
        type: "OWN_TRANSFER",
        effectiveExpense: 0,
        effectiveIncome: 0,
        hint: "Деньги остаются вашими",
      },
    ],
    expense: 7_000,
    income: 0,
    tx: [tx("acc_tbank", "debit", 7_000, "2026-09-09T13:10:00", "ATM Т-Банк")],
  }),

  ev({
    type: "REFUND",
    title: "Lamoda",
    subtitle: "Куртка не подошла",
    category: "Одежда",
    confidence: 0.95,
    expense: 0,
    income: 0,
    reason: "Возврат за покупку от 3 сентября — трата обнулилась",
    tx: [
      tx("acc_tbank", "debit", 4_200, "2026-09-03T15:20:00", "Lamoda"),
      tx("acc_tbank", "credit", 4_200, "2026-09-10T12:02:00", "Lamoda", "возврат заказа"),
    ],
  }),

  purchase("Surf Coffee", 1_120, "2026-09-11T10:30:00", "Кафе"),
  purchase("Яндекс Go", 520, "2026-09-11T22:14:00", "Транспорт"),
  purchase("ВкусВилл", 2_480, "2026-09-12T19:40:00", "Продукты"),

  ev({
    type: "UNKNOWN",
    title: "Входящий перевод",
    subtitle: "Ольга С. · «за обед»",
    confidence: 0.61,
    status: "needs_attention",
    question: "Что это за 900 ₽?",
    reason: "Похоже на возврат, но подходящей траты рядом нет",
    options: [
      {
        id: "shared",
        label: "Скинулись за обед",
        type: "SHARED_EXPENSE",
        effectiveExpense: 0,
        effectiveIncome: 0,
        hint: "Уменьшит траты на 900 ₽",
      },
      {
        id: "debt",
        label: "Вернули долг",
        type: "DEBT_REPAYMENT",
        effectiveExpense: 0,
        effectiveIncome: 0,
        hint: "Не доход и не трата",
      },
      {
        id: "income",
        label: "Это доход",
        type: "INCOME",
        effectiveExpense: 0,
        effectiveIncome: 900,
        hint: "Попадёт в доходы сентября",
      },
    ],
    expense: 0,
    income: 0,
    tx: [tx("acc_tbank", "credit", 900, "2026-09-13T14:05:00", "Ольга С.", "за обед")],
  }),

  purchase("Кинотеатр Октябрь", 1_200, "2026-09-14T20:10:00", "Развлечения"),
  purchase("Аптека Горздрав", 860, "2026-09-15T09:35:00", "Здоровье"),

  ev({
    type: "INCOME",
    title: "Кэшбэк",
    subtitle: "Т-Банк",
    confidence: 0.98,
    expense: 0,
    income: 1_240,
    tx: [tx("acc_tbank", "credit", 1_240, "2026-09-15T06:00:00", "Т-Банк", "Кэшбэк за август")],
  }),

  purchase("World Class", 3_200, "2026-09-16T08:00:00", "Здоровье"),
  purchase("Яндекс Go", 640, "2026-09-17T08:52:00", "Транспорт"),
  purchase("Магнит", 1_320, "2026-09-17T20:30:00", "Продукты"),

  ev({
    type: "UNKNOWN",
    title: "Входящий перевод",
    subtitle: "Перевод СБП",
    confidence: 0.54,
    status: "needs_attention",
    question: "Что это за 3 400 ₽?",
    reason: "Отправитель новый, описания нет",
    options: [
      {
        id: "income",
        label: "Это доход",
        type: "INCOME",
        effectiveExpense: 0,
        effectiveIncome: 3_400,
        hint: "Попадёт в доходы сентября",
      },
      {
        id: "debt",
        label: "Вернули долг",
        type: "DEBT_REPAYMENT",
        effectiveExpense: 0,
        effectiveIncome: 0,
        hint: "Не доход и не трата",
      },
      {
        id: "own",
        label: "Мой перевод себе",
        type: "OWN_TRANSFER",
        effectiveExpense: 0,
        effectiveIncome: 0,
        hint: "Счёт другого банка",
      },
    ],
    expense: 0,
    income: 0,
    tx: [tx("acc_sber", "credit", 3_400, "2026-09-18T16:40:00", "Перевод СБП")],
  }),

  purchase("Кафе Март", 1_480, "2026-09-19T13:25:00", "Кафе"),
  purchase("Кинопоиск", 299, "2026-09-19T03:00:00", "Подписки"),
  purchase("Дикси", 2_130, "2026-09-20T11:05:00", "Продукты"),
];

// ── Январь–август 2026: детерминированная история ────────────────────────

const seededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};

const historyPlan: { merchant: string; category: Category; base: number }[] = [
  { merchant: "Пятёрочка", category: "Продукты", base: 2_400 },
  { merchant: "ВкусВилл", category: "Продукты", base: 2_100 },
  { merchant: "Самокат", category: "Продукты", base: 1_700 },
  { merchant: "Surf Coffee", category: "Кафе", base: 900 },
  { merchant: "Кафе Март", category: "Кафе", base: 1_600 },
  { merchant: "Яндекс Go", category: "Транспорт", base: 560 },
  { merchant: "Аптека Горздрав", category: "Здоровье", base: 840 },
  { merchant: "World Class", category: "Здоровье", base: 3_200 },
  { merchant: "Яндекс Плюс", category: "Подписки", base: 399 },
  { merchant: "Кинопоиск", category: "Подписки", base: 299 },
  { merchant: "Ozon", category: "Дом", base: 1_900 },
  { merchant: "Кинотеатр Октябрь", category: "Развлечения", base: 1_100 },
];

const buildHistory = (): FinancialEvent[] => {
  const random = seededRandom(20_260_920);
  const events: FinancialEvent[] = [];

  for (let month = 0; month < 8; month += 1) {
    const mm = String(month + 1).padStart(2, "0");

    events.push(
      ev({
        type: "INCOME",
        title: "Зарплата",
        subtitle: "Альфа-Банк",
        confidence: 0.99,
        expense: 0,
        income: 185_000,
        tx: [tx("acc_alfa", "credit", 185_000, `2026-${mm}-01T10:04:00`, "ООО Технологии", "Заработная плата")],
      })
    );

    historyPlan.forEach((plan, index) => {
      const count = plan.base > 2_000 ? 2 : 3;
      for (let i = 0; i < count; i += 1) {
        const day = String(3 + ((index * 2 + i * 7 + month) % 25)).padStart(2, "0");
        const amount = Math.round((plan.base * (0.75 + random() * 0.6)) / 10) * 10;
        events.push(purchase(plan.merchant, amount, `2026-${mm}-${day}T13:00:00`, plan.category));
      }
    });

    // В каждом месяце есть хотя бы один «неочевидный» перевод себе
    events.push(
      ev({
        type: "OWN_TRANSFER",
        title: "Т-Банк → Сбер",
        subtitle: "Перевод между своими счетами",
        confidence: 0.99,
        expense: 0,
        income: 0,
        reason: "Одинаковая сумма, разница в секундах, оба счёта ваши",
        tx: [
          tx("acc_tbank", "debit", 10_000, `2026-${mm}-14T12:00:00`, "Перевод", "На накопительный"),
          tx("acc_sber", "credit", 10_000, `2026-${mm}-14T12:00:09`, "Перевод", "С карты Т-Банк"),
        ],
      })
    );
  }

  return events;
};

export const initialEvents: FinancialEvent[] = [...buildHistory(), ...september].sort(
  (a, b) => (a.timestamp < b.timestamp ? 1 : -1)
);

export const allTransactions: Transaction[] = transactions;

export const transactionsById = new Map(transactions.map((item) => [item.id, item]));

export const accountsById = new Map(accounts.map((item) => [item.id, item]));

/** Дата «сегодня» в демо-данных */
export const demoToday = new Date("2026-09-20T12:00:00");
