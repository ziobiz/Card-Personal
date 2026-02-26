/**
 * Wirex BaaS API 클라이언트
 * docs.wirexapp.com - KYC Hosted, Authentication, Onboarding
 * 자격증명 없으면 null 반환 (Mock 사용)
 */

import { wirexBaaS } from '../../config.js';

const TOKEN_BUFFER_SEC = 300; // 5분 전 갱신

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_at: number;
}

interface WirexUserResponse {
  id: string;
}

interface WirexCardResponse {
  id: string;
  type: 'virtual' | 'plastic';
  status: string;
  pan_last4?: string;
  panLast4?: string;
  expiry_month?: string;
  expiryMonth?: string;
  expiry_year?: string;
  expiryYear?: string;
  currency: string;
  limit?: number;
  daily_limit?: number;
  dailyLimit?: number;
  daily_used?: number;
  dailyUsed?: number;
  balance?: number;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface VerificationLinkResponse {
  url: string;
}

interface WalletBalanceResponse {
  balances?: Array<{ token_symbol: string; balance: number; reference_currency: string }>;
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string | null> {
  if (!wirexBaaS.clientId || !wirexBaaS.clientSecret) return null;
  if (cachedToken && Date.now() / 1000 < tokenExpiresAt - TOKEN_BUFFER_SEC) {
    return cachedToken;
  }
  try {
    const res = await fetch(`${wirexBaaS.apiBase}/api/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: wirexBaaS.clientId,
        client_secret: wirexBaaS.clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) return null;
    const data: TokenResponse = await res.json();
    cachedToken = data.access_token;
    tokenExpiresAt = data.expires_at;
    return cachedToken;
  } catch {
    return null;
  }
}

function buildHeaders(token: string, userContext?: { userId?: string; email?: string; walletAddress?: string }): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Chain-Id': String(wirexBaaS.chainId),
  };
  if (userContext?.userId) h['X-User-Id'] = userContext.userId;
  else if (userContext?.email) h['X-User-Email'] = userContext.email;
  else if (userContext?.walletAddress) h['X-User-Address'] = userContext.walletAddress;
  return h;
}

function toCard(c: WirexCardResponse) {
  return {
    id: c.id,
    type: c.type as 'virtual' | 'plastic',
    status: (c.status?.toLowerCase() || 'inactive') as 'active' | 'inactive' | 'blocked' | 'closed',
    panLast4: c.pan_last4 ?? c.panLast4 ?? '****',
    expiryMonth: c.expiry_month ?? c.expiryMonth ?? '**',
    expiryYear: c.expiry_year ?? c.expiryYear ?? '**',
    currency: c.currency ?? 'USD',
    limit: c.limit ?? c.daily_limit ?? c.dailyLimit,
    dailyLimit: c.daily_limit ?? c.dailyLimit ?? c.limit,
    dailyUsed: c.daily_used ?? c.dailyUsed ?? 0,
    balance: c.balance ?? 0,
    createdAt: c.created_at ?? c.createdAt ?? new Date().toISOString(),
  };
}

export const wirexBaaSClient = {
  async isConfigured(): Promise<boolean> {
    return !!(wirexBaaS.clientId && wirexBaaS.clientSecret);
  },

  /** S2S 사용자 등록 (wallet_address 필수 - On-chain 등록 완료 후) */
  async registerUser(data: {
    wallet_address: string;
    email: string;
    country: string;
  }): Promise<{ id: string } | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${wirexBaaS.apiBase}/api/v2/user`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          wallet_address: data.wallet_address,
          initial_data: {
            profile: { email: data.email },
            residence_address: { country: data.country },
          },
        }),
      });
      if (!res.ok) return null;
      const out: WirexUserResponse = await res.json();
      return { id: out.id };
    } catch {
      return null;
    }
  },

  /** KYC 검증 링크 조회 */
  async getVerificationLink(userContext: { userId?: string; email?: string; walletAddress?: string }): Promise<string | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${wirexBaaS.apiBase}/api/v1/user/verification-link`, {
        method: 'GET',
        headers: buildHeaders(token, userContext),
      });
      if (!res.ok) return null;
      const out: VerificationLinkResponse = await res.json();
      return out.url ?? null;
    } catch {
      return null;
    }
  },

  /** 카드 목록 */
  async getCards(
    userContext: { userId?: string; email?: string; walletAddress?: string },
    page = 1,
    size = 10
  ): Promise<{ items: ReturnType<typeof toCard>[]; total: number } | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(
        `${wirexBaaS.apiBase}/api/v1/cards?page=${page}&size=${size}`,
        { headers: buildHeaders(token, userContext) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : (data.cards ?? []);
      const total = typeof data.total === 'number' ? data.total : items.length;
      return { items: items.map(toCard), total };
    } catch {
      return null;
    }
  },

  /** 가상 카드 발급 */
  async createVirtualCard(
    userContext: { userId?: string; email?: string; walletAddress?: string },
    options?: { limit?: number; currency?: string }
  ): Promise<ReturnType<typeof toCard> | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${wirexBaaS.apiBase}/api/v1/cards/virtual`, {
        method: 'POST',
        headers: buildHeaders(token, userContext),
        body: JSON.stringify(options ?? {}),
      });
      if (!res.ok) return null;
      const out: WirexCardResponse = await res.json();
      return toCard(out);
    } catch {
      return null;
    }
  },

  /** 카드 차단 */
  async blockCard(
    cardId: string,
    userContext: { userId?: string; email?: string; walletAddress?: string }
  ): Promise<ReturnType<typeof toCard> | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${wirexBaaS.apiBase}/api/v1/cards/${cardId}/block`, {
        method: 'PUT',
        headers: buildHeaders(token, userContext),
      });
      if (!res.ok) return null;
      const out: WirexCardResponse = await res.json();
      return toCard(out);
    } catch {
      return null;
    }
  },

  /** 카드 차단 해제 */
  async unblockCard(
    cardId: string,
    userContext: { userId?: string; email?: string; walletAddress?: string }
  ): Promise<ReturnType<typeof toCard> | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${wirexBaaS.apiBase}/api/v1/cards/${cardId}/unblock`, {
        method: 'PUT',
        headers: buildHeaders(token, userContext),
      });
      if (!res.ok) return null;
      const out: WirexCardResponse = await res.json();
      return toCard(out);
    } catch {
      return null;
    }
  },

  /** 카드 한도 설정 */
  async setCardLimit(
    cardId: string,
    limit: number,
    userContext: { userId?: string; email?: string; walletAddress?: string }
  ): Promise<ReturnType<typeof toCard> | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${wirexBaaS.apiBase}/api/v1/cards/${cardId}/limit`, {
        method: 'PUT',
        headers: buildHeaders(token, userContext),
        body: JSON.stringify({ limit }),
      });
      if (!res.ok) return null;
      const out: WirexCardResponse = await res.json();
      return toCard(out);
    } catch {
      return null;
    }
  },

  /** 월렛 잔액 (Unified Balance) */
  async getWalletBalance(
    userContext: { userId?: string; email?: string; walletAddress?: string }
  ): Promise<Array<{ symbol: string; balance: number; currency: string }> | null> {
    const token = await getToken();
    if (!token) return null;
    try {
      const res = await fetch(`${wirexBaaS.apiBase}/api/v1/wallet`, {
        headers: buildHeaders(token, userContext),
      });
      if (!res.ok) return null;
      const data: WalletBalanceResponse = await res.json();
      const balances = data.balances ?? [];
      return balances.map((b) => ({
        symbol: b.token_symbol ?? 'WUSD',
        balance: b.balance ?? 0,
        currency: b.reference_currency ?? 'USD',
      }));
    } catch {
      return null;
    }
  },
};
