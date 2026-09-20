import React, { useEffect, useState } from 'react';
import { getEventDetails } from '@/shared/api/finance';
import { formatMoneyDelta } from '@/shared/lib/formatters';

interface MoneyGraphProps {
  eventId: string;
}

export const MoneyGraph: React.FC<MoneyGraphProps> = ({ eventId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventDetails(eventId).then(res => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, [eventId]);

  if (loading) return <div className="p-4 text-center text-zinc-500 animate-pulse text-xs">Загрузка графа...</div>;
  if (!data || !Array.isArray(data.nodes) || data.nodes.length <= 1) return null;

  const event = data.event || {};
  const nodes = data.nodes || [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const rootNode = nodes.find((n: any) => n.id === event.id) || nodes[0];
  const childrenNodes = nodes.filter((n: any) => n.id !== rootNode?.id);

  const realExpense = Math.abs(event.expense_impact_minor || event.bank_outflow_minor || event.amount_minor || 0);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 mt-3" onClick={(e) => e.stopPropagation()}>
      <h4 className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Граф движения средств</h4>
      
      <div className="flex flex-col items-center">
        {/* Root Event */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-center w-full max-w-[220px] shadow-lg relative z-10">
          <p className="text-xs font-medium text-white truncate">{rootNode?.label || rootNode?.title || event.title}</p>
          <p className="text-xs font-bold text-zinc-300 mt-0.5">{formatMoneyDelta(rootNode?.amount_minor)}</p>
        </div>

        {/* Lines */}
        {childrenNodes.length > 0 && (
          <div className="flex justify-center w-full my-1.5">
            <div className="w-px h-5 bg-zinc-700" />
          </div>
        )}

        {/* Children Grid */}
        <div className="flex flex-wrap justify-center gap-2 relative z-10 w-full">
          {childrenNodes.map((node: any) => {
            const edge = edges.find((e: any) => e.target === node.id || e.source === node.id);
            const edgeLabel = edge?.role || edge?.label || '';
            return (
              <div key={node.id} className="flex flex-col items-center">
                <div className="w-px h-2.5 bg-zinc-700 -mt-1 mb-1" />
                <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-2 text-center w-32 shadow-sm">
                  {edgeLabel && <p className="text-[10px] text-zinc-400 mb-0.5 truncate">{edgeLabel}</p>}
                  <p className="text-xs font-medium text-white truncate">{node.label || node.title}</p>
                  <p className="text-xs font-bold text-emerald-400 mt-0.5">{formatMoneyDelta(Math.abs(node.amount_minor))}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real Expense Summary */}
        <div className="mt-4 pt-3 border-t border-zinc-800 w-full flex justify-between items-center text-xs">
          <span className="text-zinc-400">Реальный расход</span>
          <span className="font-bold text-white text-sm">{formatMoneyDelta(realExpense)}</span>
        </div>
      </div>
    </div>
  );
};
