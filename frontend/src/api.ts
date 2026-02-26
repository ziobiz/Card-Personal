/**
 * 백엔드 API 클라이언트
 * Wirex API 스펙 기반
 */

// 직접 연결 (프록시 미사용) - dev: 127.0.0.1:3001, prod: VITE_API_URL
const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

const REQUEST_TIMEOUT = 15000;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const base = API || '';
  const url = base ? `${base}/api${path}` : `/api${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg = data.hint ? `${data.error} (${data.hint})` : data.error || `HTTP ${res.status}`;
      if (data._debug) msg += ` [받은이메일:${data._debug.receivedEmail}, 사용자수:${data._debug.usersCount}]`;
      throw new Error(msg);
    }
    return data as T;
  } catch (e) {
    clearTimeout(timeoutId);
    if ((e as Error).name === 'AbortError') {
      throw new Error('요청 시간 초과. 백엔드가 실행 중인지 확인해 주세요.');
    }
    throw e;
  }
}

export interface User {
  id: string;
  email: string;
  wirexUserId?: string;
}

export interface Card {
  id: string;
  userId: string;
  type: 'virtual' | 'plastic';
  status: 'inactive' | 'active' | 'blocked' | 'closed';
  panLast4: string;
  expiryMonth: string;
  expiryYear: string;
  limit?: number;
  limitType?: 'daily' | 'lifetime';
  dailyLimit?: number;
  dailyUsed?: number;
  dailyUsedResetAt?: string;
  lifetimeLimit?: number;
  lifetimeUsed?: number;
  currency: string;
  cardWalletAddress?: string;
  balance?: number;
  createdAt: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  currency: string;
  status: string;
  cardId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WalletBalance {
  primary: TokenBalance[];
  cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },
  user: {
    get: () => request<User & { status?: string }>('/user'),
  },
  cards: {
    list: (page = 1, size = 10) =>
      request<{ items: Card[]; total: number }>(`/cards?page=${page}&size=${size}`),
    createVirtual: (data?: { limit?: number; currency?: string }) =>
      request<Card>('/cards/virtual', {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    block: (cardId: string) =>
      request<Card>(`/cards/${cardId}/block`, { method: 'PUT' }),
    unblock: (cardId: string) =>
      request<Card>(`/cards/${cardId}/unblock`, { method: 'PUT' }),
    setLimit: (cardId: string, limit: number) =>
      request<Card>(`/cards/${cardId}/limit`, {
        method: 'PUT',
        body: JSON.stringify({ limit }),
      }),
    close: (cardId: string) =>
      request<Card>(`/cards/${cardId}/close`, { method: 'PUT' }),
  },
  admin: {
    login: (email: string, password: string) =>
      request<{ token: string; user: { email: string; isAdmin: boolean } }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    getUsers: () =>
      request<{ items: { id: string; email: string; wirexUserId?: string; createdAt: string }[]; total: number }>('/admin/users'),
    getCards: () =>
      request<{
        items: Array<{ userId: string; email: string; card: Card }>;
        total: number;
      }>('/admin/cards'),
    getStats: () =>
      request<{ totalUsers: number; totalCards: number; activeCards: number; totalBalance: number }>('/admin/stats'),
    getSettings: () =>
      request<{
        wirex: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string };
        useMockWirex: boolean;
        updatedAt?: string;
        _masked?: { clientSecret: string };
      }>('/admin/settings'),
    getPartners: () =>
      request<{ items: { id: string; name: string; companyName?: string; apiKeyPrefix: string; status: string; createdAt: string }[]; total: number }>('/admin/partners'),
    createPartner: (data: { name: string; companyName?: string }) =>
      request<{ partner: { id: string; name: string; companyName?: string; status: string; createdAt: string }; apiKey: string; warning: string }>('/admin/partners', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePartner: (id: string, data: { name?: string; companyName?: string; status?: string; billingWalletAddress?: string }) =>
      request<{ id: string; name: string; companyName?: string; status: string; updatedAt?: string }>(`/admin/partners/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    setPartnerBillingWallet: (id: string, billingWalletAddress: string) =>
      request<{ id: string; billingWalletAddress?: string }>(`/admin/partners/${id}/billing-wallet`, {
        method: 'PUT',
        body: JSON.stringify({ billingWalletAddress }),
      }),
    addPartnerBillingBalance: (id: string, amount: number) =>
      request<{ success: boolean; newBalance: number }>(`/admin/partners/${id}/add-billing-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    runPartnerBilling: () =>
      request<{ month: string; results: Array<{ partnerId: string; name: string; status: string; warning?: number }> }>('/admin/partners/run-billing', { method: 'POST' }),
    regeneratePartnerKey: (id: string) =>
      request<{ partner: { id: string; name: string; status: string }; apiKey: string; warning: string }>(`/admin/partners/${id}/regenerate-key`, {
        method: 'POST',
      }),
    updateSettings: (data: {
      wirex?: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string };
      feePolicy?: { treasuryWalletAddress?: string; cardIssuanceFee?: number; cardTopUpFeePercent?: number; cardUsageFeePerTransaction?: number; cardMonthlyFee?: number; partnerMonthlyFee?: number };
      useMockWirex?: boolean;
    }) =>
      request<{
        wirex: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string };
        useMockWirex: boolean;
        updatedAt?: string;
      }>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
  kyc: {
    getVerificationLink: () =>
      request<{ url: string | null; message?: string }>('/kyc/verification-link'),
  },
  wallet: {
    getBalance: () => request<WalletBalance>('/wallet/balance'),
    p2p: (toUserId: string, amount: number) =>
      request<{ success: boolean; amount: number }>('/wallet/p2p', {
        method: 'POST',
        body: JSON.stringify({ toUserId, amount }),
      }),
    refund: (amount: number) =>
      request<{ success: boolean; amount: number; fee: number }>('/wallet/refund', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    getTransactions: (page?: number, size?: number) =>
      request<{ items: Transaction[]; total: number }>(`/wallet/transactions?page=${page ?? 1}&size=${size ?? 20}`),
    getCardUsage: (cardId: string, page?: number, size?: number) =>
      request<{ items: Transaction[]; total: number }>(`/wallet/card/${cardId}/usage?page=${page ?? 1}&size=${size ?? 20}`),
    getTokens: () => request<{ tokens: { symbol: string; name: string; decimals: number }[] }>('/wallet/tokens'),
    getCardDepositInfo: (cardId: string) =>
      request<{
        cardWalletAddress: string;
        currentBalance: number;
        currency: string;
        network: string;
        supportedTokens: { symbol: string; name: string; decimals: number }[];
        note: string;
      }>(`/wallet/card/${cardId}/deposit-info`),
    depositToCard: (cardId: string, amount: number, token?: string) =>
      request<{ success: boolean; newBalance: number }>(`/wallet/card/${cardId}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount, token: token || 'USDT' }),
      }),
  },
};
