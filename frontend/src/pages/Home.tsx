import React, { useEffect, useState } from 'react';
import { getDashboard, loadDemo, resolveEvent, type DashboardResponse } from '@/shared/api/finance';
import { TotalBalanceCard } from '@/features/finance/ui/TotalBalanceCard';
import { RealSpendingCard } from '@/features/finance/ui/RealSpendingCard';
import { SpendingChart } from '@/features/finance/ui/SpendingChart';
import { NeedsAttention } from '@/features/finance/ui/NeedsAttention';
import { MoneyGraph } from '@/features/finance/ui/MoneyGraph';
import { formatMoneyDelta, getEventAmount } from '@/shared/lib/formatters';
import { getCategoryMeta } from '@/shared/lib/financeLabels';
import { useAuth } from '@/app/providers/auth/useAuth';

type PeriodType = 'day' | 'week' | 'month' | 'year';

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
};

export default function HomePage() {
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('month');

  const fetchDashboard = async (p: PeriodType = period) => {
    try {
      const data = await getDashboard({ period: p, date: '2026-09-20' });
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(period);
  }, [period]);

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemo('2026-09-01');
      await fetchDashboard(period);
    } catch (err) {
      console.error('Failed to load demo:', err);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleResolve = async (id: string, payload: any) => {
    try {
      await resolveEvent(id, payload);
      await fetchDashboard(period);
    } catch (err) {
      console.error('Failed to resolve event:', err);
    }
  };

  const events = dashboard?.recent_events || dashboard?.latest_events || [];
  const attentionItems = dashboard?.attention_preview || dashboard?.attention || [];
  const userName = auth?.user?.name || auth?.user?.email?.split('@')[0] || 'Пользователь';

  // Format date range text
  const formatDateRange = () => {
    if (!dashboard?.summary?.start_date || !dashboard?.summary?.end_date) return '';
    const start = new Date(dashboard.summary.start_date);
    const end = new Date(dashboard.summary.end_date);

    if (period === 'day') {
      return start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (period === 'month') {
      return start.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    }
    return `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="bg-black min-h-screen text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative pb-24">
        
        {/* Header / Top bar */}
        <header className="px-5 py-5 flex items-center justify-between sticky top-0 bg-black/85 backdrop-blur-xl z-50 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-zinc-800 rounded-2xl flex items-center justify-center border border-emerald-500/30 shadow-md shadow-emerald-950/40">
              <span className="text-sm font-bold text-white tracking-wider">
                {userName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-medium text-emerald-400">Честный месяц</p>
              <h2 className="text-sm font-bold text-white">{userName}</h2>
            </div>
          </div>
          
          <button 
            onClick={handleLoadDemo}
            disabled={loadingDemo}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {loadingDemo ? (
              <>
                <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Загрузка...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Загрузить демо</span>
              </>
            )}
          </button>
        </header>

        {/* Period Switcher Tabs */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-1 rounded-2xl">
            {(['day', 'week', 'month', 'year'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  period === p
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {dashboard?.summary && (
            <p className="text-center text-[11px] text-zinc-400 font-medium capitalize mt-2">
              {formatDateRange()}
            </p>
          )}
        </div>

        {/* Main Content */}
        <main className="flex-1 px-5 pt-2">
          {loading && !dashboard ? (
            <div className="text-center py-20 text-zinc-500 animate-pulse text-sm">
              Синхронизация финансовых событий...
            </div>
          ) : !dashboard ? (
            <div className="text-center py-20 text-zinc-500 text-sm">
              Не удалось загрузить данные. Нажмите «Загрузить демо», чтобы наполнить базу.
            </div>
          ) : (
            <>
              {/* Total Balance Card */}
              <TotalBalanceCard 
                totalBalanceMinor={dashboard.total_balance_minor} 
                accounts={dashboard.accounts} 
              />

              {/* Real Spending vs Bank Card with Explanation Drawer */}
              <RealSpendingCard 
                bankOutflowMinor={dashboard.summary?.bank_outflow_minor ?? 0} 
                realExpenseMinor={dashboard.summary?.real_expense_minor ?? 0} 
                excludedBreakdown={dashboard.summary?.excluded_breakdown}
                excludedMinor={dashboard.summary?.excluded_minor}
              />

              {/* Interactive Donut & Timeline Spending Chart */}
              <SpendingChart 
                categories={dashboard.summary?.categories} 
                timeline={dashboard.summary?.timeline} 
                totalExpenseMinor={dashboard.summary?.real_expense_minor ?? 0} 
              />
              
              {/* Needs Attention block */}
              <NeedsAttention 
                items={attentionItems} 
                onResolve={handleResolve} 
              />

              {/* Financial Events Feed */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-white">Реконструированные события</h3>
                  <span className="text-xs text-zinc-500">
                    {events.length} {events.length === 1 ? 'событие' : 'событий'}
                  </span>
                </div>

                {events.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
                    Событий за этот период нет
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event: any) => {
                      const amount = getEventAmount(event);
                      const isIncome = amount > 0;
                      const dateStr = event.occurred_at || event.created_at;
                      const displayDate = dateStr ? new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
                      const catMeta = getCategoryMeta(event.category);

                      return (
                        <div 
                          key={event.id} 
                          className={`bg-zinc-900/90 border rounded-2xl p-4 flex flex-col transition-all cursor-pointer ${
                            expandedEventId === event.id 
                              ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/30' 
                              : 'border-zinc-800 hover:border-zinc-700'
                          }`}
                          onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base font-bold transition-transform ${
                                  isIncome 
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60'
                                }`}
                              >
                                {isIncome ? '↓' : '↑'}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-white truncate max-w-[170px]">
                                  {event.title}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span 
                                    className="w-1.5 h-1.5 rounded-full" 
                                    style={{ backgroundColor: catMeta.color }} 
                                  />
                                  <p className="text-[10px] text-zinc-400">{catMeta.label}</p>
                                  {event.status === 'needs_attention' && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold ml-1">
                                      Уточнить
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className={`text-xs font-bold ${isIncome ? 'text-emerald-400' : 'text-white'}`}>
                                {formatMoneyDelta(amount)}
                              </p>
                              {displayDate && <p className="text-[10px] text-zinc-500 mt-0.5">{displayDate}</p>}
                            </div>
                          </div>

                          {/* Expandable Money Graph */}
                          {expandedEventId === event.id && (
                            <MoneyGraph eventId={event.id} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
