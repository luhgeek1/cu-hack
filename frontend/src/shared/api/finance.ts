import apiProtected from './axiosInstance';

export interface FinancialEvent {
  id: string;
  type: string;
  status: string;
  title: string;
  occurred_at: string;
  currency: string;
  category: string;
  confidence: number;
  reason: string;
  related_event_id?: string | null;
  remaining_minor?: number | null;
  contributions: any[];
  funding_links: any[];
  expense_impact_minor: number;
  income_impact_minor: number;
  bank_outflow_minor: number;
  bank_inflow_minor: number;
  amount_minor?: number;
  created_at?: string;
}

export interface AttentionItem {
  event: FinancialEvent;
  question?: string;
  options: { label: string; action: string; related_event_id?: string }[];
}

export interface DashboardResponse {
  summary: {
    start_date?: string;
    end_date?: string;
    timezone?: string;
    currency?: string;
    bank_outflow_minor: number;
    bank_inflow_minor: number;
    real_expense_minor: number;
    real_income_minor: number;
    net_income_minor: number;
    excluded_minor: number;
    excluded_breakdown?: any;
    categories?: any[];
    timeline?: any[];
    needs_attention_count?: number;
    unresolved_inflow_minor?: number;
    is_provisional?: boolean;
  };
  comparison?: any;
  total_balance_minor?: number;
  accounts: any[];
  recent_events: FinancialEvent[];
  latest_events: FinancialEvent[];
  attention_preview: AttentionItem[];
  attention: AttentionItem[];
}

export interface ResolveRequest {
  action: string;
  related_event_id?: string;
}

export const loadDemo = async (month: string) => {
  const { data } = await apiProtected.post('/demo/load', { month });
  return data;
};

export const getDashboard = async (params?: { period?: string; date?: string; start_date?: string; end_date?: string }) => {
  const { data } = await apiProtected.get<any>('/dashboard', { params });
  const recentEvents = data?.recent_events || data?.latest_events || [];
  const attentionItems = data?.attention_preview || data?.attention || [];
  return {
    ...data,
    summary: data?.summary || {
      bank_outflow_minor: 0,
      bank_inflow_minor: 0,
      real_expense_minor: 0,
      real_income_minor: 0,
      net_income_minor: 0,
      excluded_minor: 0,
    },
    accounts: data?.accounts || [],
    recent_events: recentEvents,
    latest_events: recentEvents,
    attention_preview: attentionItems,
    attention: attentionItems,
  } as DashboardResponse;
};

export const getAttention = async () => {
  const { data } = await apiProtected.get<{ items: AttentionItem[]; total: number }>('/attention');
  return data;
};

export const resolveEvent = async (id: string, payload: ResolveRequest) => {
  const { data } = await apiProtected.post(`/events/${id}/resolve`, payload);
  return data;
};

export const getEventDetails = async (id: string) => {
  const { data } = await apiProtected.get(`/events/${id}`);
  return data;
};

export const getAnalytics = async (params?: { period?: string; date?: string }) => {
  const { data } = await apiProtected.get('/analytics', { params });
  return data;
};
