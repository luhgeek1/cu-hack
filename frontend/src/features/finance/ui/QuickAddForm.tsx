import React, { useState } from 'react';
import { Plus, Mic } from 'lucide-react';

export const QuickAddForm: React.FC = () => {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    // In a real app, this would add a transaction
    console.log('Added:', amount);
    setAmount('');
  };

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="text-zinc-500 text-lg">₽</span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-8 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-lg font-medium shadow-inner"
          />
        </div>
        
        <button 
          type="button"
          className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shrink-0"
        >
          <Mic size={24} />
        </button>

        <button 
          type="submit"
          className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 shrink-0"
        >
          <Plus size={24} />
        </button>
      </form>
      <p className="text-xs text-zinc-500 mt-3 text-center">
        Fast Add: Type amount and press +, or use Voice.
      </p>
    </div>
  );
};
