import React, { useState } from 'react';
import { formatMoneyDelta, getEventAmount } from '@/shared/lib/formatters';
import type { AttentionItem, ResolveRequest } from '@/shared/api/finance';

interface NeedsAttentionProps {
  items: AttentionItem[];
  onResolve: (id: string, payload: ResolveRequest) => Promise<void>;
}

export const NeedsAttention: React.FC<NeedsAttentionProps> = ({ items, onResolve }) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const safeItems = Array.isArray(items) ? items.filter(i => i && i.event) : [];
  if (safeItems.length === 0) return null;

  const handleResolve = async (id: string, action: string, relatedEventId?: string) => {
    setResolvingId(id);
    try {
      await onResolve(id, { action, related_event_id: relatedEventId });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          Требует внимания
          <span className="bg-amber-500/20 text-amber-500 text-xs px-2 py-0.5 rounded-full font-bold">
            {safeItems.length}
          </span>
        </h3>
      </div>
      
      <div className="space-y-3">
        {safeItems.map((item) => {
          const amount = getEventAmount(item.event);
          const dateStr = item.event.occurred_at || item.event.created_at;
          const displayDate = dateStr ? new Date(dateStr).toLocaleString('ru-RU') : '';

          return (
            <div key={item.event.id} className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-zinc-300 font-medium">{item.event.title}</p>
                  {displayDate && <p className="text-xs text-zinc-500">{displayDate}</p>}
                </div>
                <span className={`text-base font-bold ${amount > 0 ? 'text-emerald-400' : 'text-white'}`}>
                  {formatMoneyDelta(amount)}
                </span>
              </div>
              
              <p className="text-sm text-zinc-400 mb-3">{item.question || 'Что это за операция?'}</p>
              
              <div className="flex flex-wrap gap-2">
                {(item.options || []).map((opt, i) => (
                  <button
                    key={i}
                    disabled={resolvingId === item.event.id}
                    onClick={() => handleResolve(item.event.id, opt.action, opt.related_event_id)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all text-xs text-zinc-200 rounded-lg border border-zinc-700 disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
