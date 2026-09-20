export type TransactionType = 
  | 'expense' 
  | 'income' 
  | 'transfer' 
  | 'loan_given' 
  | 'loan_returned'
  | 'split_returned'
  | 'refund'
  | 'marketplace_topup'
  | 'atm_withdrawal';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  date: string; // ISO string
  type: TransactionType;
  category?: string;
  linkedId?: string; // To link a return to a specific expense/loan
}

export const MOCK_TRANSACTIONS: Transaction[] = [
  // 1. Transfer between own cards
  {
    id: 't1',
    title: 'Перевод между своими счетами',
    amount: 10000,
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    type: 'transfer',
  },
  // 2. Marketplace topup and spend
  {
    id: 't2',
    title: 'Пополнение Ozon Карт',
    amount: 6000,
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    type: 'marketplace_topup',
  },
  {
    id: 't3',
    title: 'Ozon - Бытовая техника',
    amount: 5500,
    date: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
    type: 'expense',
    category: 'Покупки',
    linkedId: 't2'
  },
  // 3. Loan 3000 and 2 returns of 1500
  {
    id: 't4',
    title: 'Дал в долг Максиму',
    amount: 3000,
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    type: 'loan_given',
  },
  {
    id: 't5',
    title: 'Максим - Возврат долга (1/2)',
    amount: 1500,
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    type: 'loan_returned',
    linkedId: 't4'
  },
  {
    id: 't6',
    title: 'Максим - Возврат долга (2/2)',
    amount: 1500,
    date: new Date().toISOString(),
    type: 'loan_returned',
    linkedId: 't4'
  },
  // 4. Split bill 8000 and 4 returns of 1600
  {
    id: 't7',
    title: 'Ресторан "Сыроварня"',
    amount: 8000,
    date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    type: 'expense',
    category: 'Рестораны'
  },
  {
    id: 't8',
    title: 'Перевод от Анны (за ужин)',
    amount: 1600,
    date: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
    type: 'split_returned',
    linkedId: 't7'
  },
  {
    id: 't9',
    title: 'Перевод от Ивана (за ужин)',
    amount: 1600,
    date: new Date(Date.now() - 1000 * 60 * 60 * 69).toISOString(),
    type: 'split_returned',
    linkedId: 't7'
  },
  // 5. Refund from store
  {
    id: 't10',
    title: 'Возврат H&M',
    amount: 4200,
    date: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    type: 'refund'
  },
  // 6. ATM withdrawal
  {
    id: 't11',
    title: 'Снятие наличных (Банкомат)',
    amount: 5000,
    date: new Date(Date.now() - 1000 * 60 * 60 * 150).toISOString(),
    type: 'atm_withdrawal'
  },
  // Normal income
  {
    id: 't12',
    title: 'Зарплата',
    amount: 150000,
    date: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
    type: 'income'
  }
];
