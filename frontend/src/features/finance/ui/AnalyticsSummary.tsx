import React from 'react';
import { MOCK_TRANSACTIONS } from '../model/mockData';

export const AnalyticsSummary: React.FC = () => {
  // Simple logic to aggregate total expenses for demonstration
  const totalExpenses = MOCK_TRANSACTIONS.reduce((acc, tx) => {
    // Exclude transfers, returned splits/loans, and refunds from true "expense" logic for analytics
    // Wait, let's keep it simple for the demo UI
    if (tx.type === 'expense' || tx.type === 'marketplace_topup') {
      return acc + tx.amount;
    }
    return acc;
  }, 0);
  
  const totalIncome = MOCK_TRANSACTIONS.reduce((acc, tx) => {
    if (tx.type === 'income') {
      return acc + tx.amount;
    }
    return acc;
  }, 0);

  // Hardcode realistic split values to demonstrate "week/month match"
  const weeklyExpense = 4500;
  const prevWeeklyExpense = 5200;
  
  const progressPercent = Math.min(Math.round((weeklyExpense / prevWeeklyExpense) * 100), 100);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Analytics</h2>
        <span className="text-sm text-emerald-400 cursor-pointer hover:underline">View details</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Weekly Box */}
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-1">This Week</p>
          <p className="text-xl font-bold text-white mb-3">₽ {weeklyExpense.toLocaleString('ru-RU')}</p>
          
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <p className="text-xs text-zinc-500">
            {progressPercent < 100 ? 'Lower than last week' : 'Higher than last week'}
          </p>
        </div>

        {/* Monthly Box */}
        <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-1">PALATA</p>
          <p className="text-xl font-bold text-white mb-3">₽ {totalExpenses.toLocaleString('ru-RU')}</p>
          
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2">
            <div 
              className="bg-zinc-500 h-1.5 rounded-full" 
              style={{ width: `40%` }}
            ></div>
          </div>
          <p className="text-xs text-zinc-500">
            On track with budget
          </p>
        </div>
      </div>
    </div>
  );
};
