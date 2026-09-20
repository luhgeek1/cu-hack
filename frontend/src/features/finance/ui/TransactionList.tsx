import React from 'react';
import { MOCK_TRANSACTIONS, Transaction } from '../model/mockData';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Repeat, 
  ShoppingCart, 
  Landmark, 
  CreditCard,
  Banknote,
  Undo2
} from 'lucide-react';

const getIconForType = (type: Transaction['type']) => {
  switch (type) {
    case 'income':
    case 'split_returned':
    case 'loan_returned':
    case 'refund':
      return <ArrowDownLeft className="text-emerald-400" size={20} />;
    case 'expense':
      return <ShoppingCart className="text-zinc-400" size={20} />;
    case 'transfer':
      return <Repeat className="text-blue-400" size={20} />;
    case 'marketplace_topup':
      return <CreditCard className="text-purple-400" size={20} />;
    case 'loan_given':
      return <ArrowUpRight className="text-orange-400" size={20} />;
    case 'atm_withdrawal':
      return <Banknote className="text-yellow-400" size={20} />;
    default:
      return <Landmark className="text-zinc-400" size={20} />;
  }
};

const getAmountColor = (type: Transaction['type']) => {
  switch (type) {
    case 'income':
    case 'split_returned':
    case 'loan_returned':
    case 'refund':
      return 'text-emerald-400';
    case 'expense':
    case 'marketplace_topup':
    case 'loan_given':
    case 'atm_withdrawal':
      return 'text-white';
    case 'transfer':
      return 'text-zinc-300';
    default:
      return 'text-white';
  }
};

const getSign = (type: Transaction['type']) => {
  switch (type) {
    case 'income':
    case 'split_returned':
    case 'loan_returned':
    case 'refund':
      return '+';
    case 'expense':
    case 'marketplace_topup':
    case 'loan_given':
    case 'atm_withdrawal':
      return '-';
    case 'transfer':
      return '';
    default:
      return '';
  }
};

export const TransactionList: React.FC = () => {
  // Sort by date descending
  const sortedTransactions = [...MOCK_TRANSACTIONS].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
      
      <div className="space-y-3">
        {sortedTransactions.map((tx) => (
          <div key={tx.id} className="bg-zinc-900 rounded-2xl p-4 flex items-center justify-between border border-zinc-800">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                {getIconForType(tx.type)}
              </div>
              <div>
                <p className="text-base font-medium text-white">{tx.title}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-400 font-normal">
                    {new Date(tx.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </p>
                  {tx.category && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                      <p className="text-sm text-zinc-500 font-normal">{tx.category}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className={`font-medium ${getAmountColor(tx.type)}`}>
                {getSign(tx.type)}₽ {tx.amount.toLocaleString('ru-RU')}
              </p>
              {tx.type === 'transfer' && (
                <p className="text-xs text-zinc-500 mt-1">Перевод</p>
              )}
              {tx.linkedId && (
                <p className="text-xs text-emerald-500 mt-1 flex items-center justify-end gap-1">
                  <Undo2 size={12} />
                  Связанная
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
