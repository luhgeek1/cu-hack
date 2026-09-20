import React from 'react';

export const PlataCard: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-emerald-500 to-emerald-900 rounded-[32px] p-6 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden">
      {/* Subtle glass overlay/shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
      <div className="relative z-10">
        <p className="text-emerald-100 text-sm font-medium mb-1">Total Balance</p>
        <h1 className="text-4xl font-bold tracking-tight mb-8">₽ 124,500.00</h1>
        <div className="flex justify-between items-end">
          <p className="text-sm font-medium opacity-80">Honest Month</p>
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm" />
            <div className="w-8 h-8 rounded-full bg-white/40 backdrop-blur-sm" />
          </div>
        </div>
      </div>
    </div>
  );
};
