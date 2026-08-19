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
  if (token && !headers.Authorization) headers['Authorization'] = `Bearer ${token}`;

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

export interface PartnerFeeFields {
  cardIssuanceFee?: number;
  cardTopUpFeePercent?: number;
  cardUsageFeePerTransaction?: number;
  cardMonthlyFee?: number;
  partnerMonthlyFee?: number;
}

export interface WalletBalance {
  primary: TokenBalance[];
  cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
}

export interface BrandConfig {
  productName: string;
  operatorName: string;
  cardBrandName: string;
  copyright: string;
  supportEmail: string;
  headerBg: string;
  sidebarBg: string;
  accentColor: string;
  logoBg: string;
  logoAdmin: string;
  logoLogin: string;
  favicon: string;
  updatedAt?: string;
}

export const DEFAULT_BRAND: BrandConfig = {
  productName: 'ICOCARD',
  operatorName: 'ONTHELINE',
  cardBrandName: 'ICOCARD',
  copyright: 'Copyright © 2026 ICOCARD Service by ONTHELINE',
  supportEmail: '',
  headerBg: '#2b2f36',
  sidebarBg: '#3d434c',
  accentColor: '#6b5ce7',
  logoBg: '#1c1f24',
  logoAdmin: '',
  logoLogin: '',
  favicon: '',
};

export async function fetchPublicBrand(): Promise<BrandConfig> {
  const base = API || '';
  const url = base ? `${base}/api/brand` : '/api/brand';
  try {
    const res = await fetch(url);
    if (!res.ok) return DEFAULT_BRAND;
    return { ...DEFAULT_BRAND, ...(await res.json()) };
  } catch {
    return DEFAULT_BRAND;
  }
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: User; otpRequired?: boolean; mustChangePassword?: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    verifyOtp: (code: string) =>
      request<{ token: string; user?: User }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
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
    createPlastic: (data?: { card_name?: string; name_on_card?: string }) =>
      request<Card>('/cards/plastic', {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    provisionWallet: (cardId: string, wallet: 'apple_pay' | 'google_pay') =>
      request(`/cards/${cardId}/wallet-tokens`, {
        method: 'POST',
        body: JSON.stringify({ wallet }),
      }),
    threeDs: () => request<{ items?: unknown[] }>('/cards/3ds/requests'),
    approve3ds: (id: string) =>
      request(`/cards/3ds/${id}/approve`, { method: 'POST' }),
    decline3ds: (id: string) =>
      request(`/cards/3ds/${id}/decline`, { method: 'POST' }),
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
      request<{ token: string; user: { email: string; isAdmin: boolean }; mustChangePassword?: boolean }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    changePassword: (password: string) =>
      request<{ ok: boolean }>('/admin/me/password', { method: 'PUT', body: JSON.stringify({ password }) }),
    getUsers: () =>
      request<{ items: { id: string; email: string; wirexUserId?: string; createdAt: string; source?: string; partnerId?: string }[]; total: number }>('/admin/users'),
    getOperators: (scope?: 'HQ' | 'PARTNER') =>
      request<{ items: Array<{ id: string; email: string; name: string; scope: string; role: string; partnerId?: string; partnerName?: string; status: string; createdAt: string }>; total: number }>(
        `/admin/operators${scope ? `?scope=${scope}` : ''}`
      ),
    createOperator: (data: { email: string; name: string; password: string; scope: 'HQ' | 'PARTNER'; role?: string; partnerId?: string }) =>
      request('/admin/operators', { method: 'POST', body: JSON.stringify(data) }),
    updateOperator: (id: string, data: { name?: string; role?: string; status?: string; password?: string }) =>
      request(`/admin/operators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getMembers: (source?: 'direct' | 'partner') =>
      request<{ items: Array<{ id: string; email: string; wirexUserId?: string; source: string; partnerId?: string; partnerName?: string; country?: string; kycStatus?: string; status: string; createdAt: string }>; total: number }>(
        `/admin/members${source ? `?source=${source}` : ''}`
      ),
    updateMember: (id: string, data: { status?: string }) =>
      request(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
      request<{
        items: Array<{
          id: string;
          name: string;
          companyName?: string;
          apiKeyPrefix: string;
          status: string;
          billingWalletAddress?: string;
          billingWarnings?: number;
          lastBillingMonth?: string;
          fees?: PartnerFeeFields;
          customFees?: boolean;
          feePolicyId?: string;
          feeSource?: string;
          feeTemplateName?: string;
          effectiveFees?: PartnerFeeFields;
          createdAt: string;
        }>;
        total: number;
      }>('/admin/partners'),
    createPartner: (data: Record<string, unknown>) =>
      request<{ partner: { id: string; name: string; companyName?: string; status: string; createdAt: string }; apiKey: string; loginId?: string; orgCode?: string; warning: string }>('/admin/partners', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePartner: (id: string, data: {
      name?: string;
      companyName?: string;
      status?: string;
      billingWalletAddress?: string;
      fees?: PartnerFeeFields;
      resetFees?: boolean;
      feePolicyId?: string;
      cardIssuePolicy?: string;
      allowVirtual?: boolean;
      allowPlastic?: boolean;
      distribution?: Record<string, number>;
      distributionApplyStart?: string;
    }) =>
      request<{ id: string; name: string; companyName?: string; status: string; fees?: PartnerFeeFields; customFees?: boolean; effectiveFees?: PartnerFeeFields; updatedAt?: string }>(`/admin/partners/${id}`, {
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
    getOrg: (level?: string) =>
      request<{ items: Array<{ id: string; orgLevel: string; parentId?: string; parentName?: string; code: string; name: string; status: string; partnerId?: string; loginId?: string }>; total: number }>(
        `/admin/org${level ? `?level=${encodeURIComponent(level)}` : ''}`
      ),
    getOrgParents: (forLevel: string) =>
      request<{ items: Array<{ id: string; orgLevel: string; name: string; code: string }> }>(`/admin/org/parents?forLevel=${encodeURIComponent(forLevel)}`),
    createOrg: (data: Record<string, unknown>) =>
      request('/admin/org', { method: 'POST', body: JSON.stringify(data) }),
    checkLoginId: (email: string) =>
      request<{ available: boolean }>(`/admin/login-id-available?email=${encodeURIComponent(email)}`),
    searchPostcode: (country: string, q: string) =>
      request<{ items: Array<{ zip: string; address: string }> }>(
        `/admin/postcode?country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}`
      ),
    updateOrg: (id: string, data: { name?: string; status?: string; parentId?: string }) =>
      request(`/admin/org/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getSalesFeePolicy: () =>
      request<{
        cardIssuanceFee: number;
        cardTopUpFeePercent: number;
        cardUsageFeePerTransaction: number;
        cardMonthlyFee: number;
        partnerMonthlyFee: number;
        plasticIssuanceFee: number;
        distribution: Record<string, number>;
      }>('/admin/sales-fee-policy'),
    updateSalesFeePolicy: (data: Record<string, unknown>) =>
      request('/admin/sales-fee-policy', { method: 'PUT', body: JSON.stringify(data) }),
    getFeeTemplates: () =>
      request<{
        items: Array<{
          id: string;
          name: string;
          description?: string;
          isHqDefault: boolean;
          fees: PartnerFeeFields & { plasticIssuanceFee?: number };
          distribution: Record<string, number>;
        }>;
      }>('/admin/fee-templates'),
    createFeeTemplate: (data: Record<string, unknown>) =>
      request('/admin/fee-templates', { method: 'POST', body: JSON.stringify(data) }),
    updateFeeTemplate: (id: string, data: Record<string, unknown>) =>
      request(`/admin/fee-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFeeTemplate: (id: string) =>
      request(`/admin/fee-templates/${id}`, { method: 'DELETE' }),
    getCommissions: (partnerId?: string) =>
      request<{ items: unknown[]; total: number }>(`/admin/commissions${partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : ''}`),
    getBrand: () => request<BrandConfig>('/admin/brand'),
    updateBrand: (data: Partial<BrandConfig>) =>
      request<BrandConfig>('/admin/brand', { method: 'PUT', body: JSON.stringify(data) }),
    updateSettings: (data: {
      wirex?: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string; environment?: 'sandbox' | 'production' };
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
    status: () =>
      request<{ kycStatus: string; kycLevel?: string; capabilities?: string[]; mock?: boolean }>('/kyc/status'),
  },
  activities: {
    list: () => request<{ data?: unknown[]; items?: unknown[]; total?: number }>('/activities'),
  },
  reporting: {
    reconciliation: () =>
      request<{ entries: unknown[]; summary: unknown; note?: string }>('/reporting/reconciliation'),
    statement: () => request<unknown>('/reporting/statement'),
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
  partnerPortal: {
    login: (email: string, password: string) =>
      request<{
        token: string;
        otpRequired?: boolean;
        mustChangePassword?: boolean;
        operator: { id: string; email: string; name: string; role: string };
        partner: { id: string; name: string; companyName?: string };
      }>('/partner-portal/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    verifyOtp: (code: string) => {
      const token = localStorage.getItem('partnerToken');
      return request<{ token: string; mustChangePassword?: boolean }>('/partner-portal/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    changePassword: (password: string) => {
      const token = localStorage.getItem('partnerToken');
      return request<{ ok: boolean }>('/partner-portal/password', {
        method: 'PUT',
        body: JSON.stringify({ password }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    overview: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{
        partner: { id: string; name: string; companyName?: string; status: string; cardIssuePolicy?: string; allowVirtual: boolean; allowPlastic: boolean };
        fees: {
          cardIssuanceFee: number;
          cardTopUpFeePercent: number;
          cardUsageFeePerTransaction: number;
          cardMonthlyFee: number;
          partnerMonthlyFee: number;
        };
        feeSource?: string;
        feeTemplateName?: string;
        apiBase: string;
      }>('/partner-portal/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
  },
};
