/**
 * Wirex BaaS REST Client
 * 공식 문서: https://docs.wirexapp.com/docs/getting-started
 *
 * Sandbox: https://api-baas.wirexapp.tech  (Base Sepolia 84532)
 * Production: https://api-baas.wirexapp.com (Base 8453)
 *
 * 제미나이 초안의 `https://api.sandbox...` / POST /users / POST /cards 는 공식 스펙이 아님.
 * 실제 경로:
 *  - POST /api/v1/token
 *  - POST /api/v2/user
 *  - POST /api/v2/cards/virtual | /plastic
 *  - GET  /api/v1/cards
 */

import { getWirexBaaSConfig } from '../../config.js';
import { type UserContext, WirexApiError, type TokenResponse, type CardDto, type WalletBalanceItem } from './types.js';

const TOKEN_BUFFER_SEC = 300;

function mapCard(c: Record<string, unknown>): CardDto {
  const status = String(c.status ?? 'inactive').toLowerCase();
  return {
    id: String(c.id),
    type: (c.type as CardDto['type']) ?? 'virtual',
    status: (['inactive', 'active', 'blocked', 'closed'].includes(status) ? status : 'inactive') as CardDto['status'],
    panLast4: String(c.pan_last4 ?? c.panLast4 ?? '****'),
    expiryMonth: String(c.expiry_month ?? c.expiryMonth ?? '**'),
    expiryYear: String(c.expiry_year ?? c.expiryYear ?? '**'),
    currency: String(c.currency ?? 'USD'),
    limit: (c.limit ?? c.daily_limit ?? c.dailyLimit) as number | undefined,
    dailyLimit: (c.daily_limit ?? c.dailyLimit ?? c.limit) as number | undefined,
    dailyUsed: Number(c.daily_used ?? c.dailyUsed ?? 0),
    balance: Number(c.balance ?? 0),
    createdAt: String(c.created_at ?? c.createdAt ?? new Date().toISOString()),
  };
}

export class WirexClient {
  private token: string | null = null;
  private expiresAt = 0;

  private cfg() {
    return getWirexBaaSConfig();
  }

  isConfigured(): boolean {
    const c = this.cfg();
    return !!(c.clientId && c.clientSecret);
  }

  async getAccessToken(): Promise<string> {
    const c = this.cfg();
    if (!c.clientId || !c.clientSecret) {
      throw new WirexApiError('Wirex credentials not configured', 401);
    }
    if (this.token && Date.now() / 1000 < this.expiresAt - TOKEN_BUFFER_SEC) {
      return this.token;
    }
    const res = await fetch(`${c.apiBase}/api/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) {
      throw new WirexApiError(`Token exchange failed: ${res.status}`, res.status, await res.json().catch(() => ({})));
    }
    const data = (await res.json()) as TokenResponse;
    this.token = data.access_token;
    this.expiresAt = data.expires_at;
    return this.token;
  }

  private headers(user?: UserContext): Record<string, string> {
    const c = this.cfg();
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Chain-Id': String(c.chainId),
    };
    // 공식: 사용자 식별 헤더는 하나만 (X-User-Address | X-User-Id | X-User-Email)
    if (user?.walletAddress) h['X-User-Address'] = user.walletAddress;
    else if (user?.userId) h['X-User-Id'] = user.userId;
    else if (user?.email) h['X-User-Email'] = user.email;
    return h;
  }

  private async request<T>(method: string, path: string, user?: UserContext, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const c = this.cfg();
    const res = await fetch(`${c.apiBase}${path}`, {
      method,
      headers: { ...this.headers(user), Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const desc = (data as { error_description?: string; error?: string }).error_description
        || (data as { error?: string }).error
        || `HTTP ${res.status}`;
      throw new WirexApiError(desc, res.status, data);
    }
    return data as T;
  }

  /** POST /api/v2/user — 온체인 등록 완료된 EOA wallet_address 필요 */
  async registerUser(data: { wallet_address: string; email: string; country: string }): Promise<{ id: string }> {
    const out = await this.request<{ id?: string; user_id?: string }>('POST', '/api/v2/user', undefined, {
      wallet_address: data.wallet_address,
      initial_data: {
        profile: { email: data.email },
        residence_address: { country: data.country },
      },
    });
    return { id: out.id ?? out.user_id ?? '' };
  }

  /** GET /api/v2/user — 자격(VisaVirtualCard 등) 및 KYC 상태 */
  async getUser(user: UserContext): Promise<unknown> {
    return this.request('GET', '/api/v2/user', user);
  }

  /**
   * KYC 호스팅 링크.
   * OpenAPI: POST /api/v1/user/verification-link
   */
  async getVerificationLink(user: UserContext): Promise<string | null> {
    try {
      const out = await this.request<{ url?: string }>('POST', '/api/v1/user/verification-link', user, {});
      return out.url ?? null;
    } catch {
      try {
        const out = await this.request<{ url?: string }>('GET', '/api/v1/user/verification-link', user);
        return out.url ?? null;
      } catch {
        return null;
      }
    }
  }

  async getCards(user: UserContext, page = 1, size = 10): Promise<{ items: CardDto[]; total: number }> {
    const data = await this.request<Record<string, unknown>>('GET', `/api/v1/cards?page=${page}&size=${size}`, user);
    const raw = Array.isArray(data.items) ? data.items : (data.cards as unknown[]) ?? [];
    const items = (raw as Record<string, unknown>[]).map(mapCard);
    const total = typeof data.total === 'number' ? data.total : items.length;
    return { items, total };
  }

  async getCard(user: UserContext, cardId: string): Promise<CardDto> {
    const data = await this.request<Record<string, unknown>>('GET', `/api/v1/cards/${cardId}`, user);
    return mapCard(data);
  }

  /** POST /api/v2/cards/virtual — 직접 인보이스(유저 잔액에서 수수료 결제) */
  async issueVirtualCard(user: UserContext, body?: { card_name?: string; name_on_card?: string; delivery_id?: number }): Promise<CardDto> {
    const out = await this.request<{ id: string } & Record<string, unknown>>('POST', '/api/v2/cards/virtual', user, body ?? {});
    return mapCard({ ...out, type: 'virtual', status: 'active' });
  }

  /** POST /api/v2/cards/plastic — Co-Branded 실물 카드 */
  async issuePlasticCard(
    user: UserContext,
    body: {
      card_name?: string;
      name_on_card?: string;
      delivery_id?: number;
      delivery_address?: Record<string, unknown>;
    }
  ): Promise<CardDto> {
    const out = await this.request<{ id: string } & Record<string, unknown>>('POST', '/api/v2/cards/plastic', user, body);
    return mapCard({ ...out, type: 'plastic', status: 'inactive' });
  }

  async blockCard(user: UserContext, cardId: string): Promise<CardDto> {
    const out = await this.request<Record<string, unknown>>('PUT', `/api/v1/cards/${cardId}/block`, user);
    return mapCard(out);
  }

  async unblockCard(user: UserContext, cardId: string): Promise<CardDto> {
    const out = await this.request<Record<string, unknown>>('PUT', `/api/v1/cards/${cardId}/unblock`, user);
    return mapCard(out);
  }

  async activateCard(user: UserContext, cardId: string, body?: { last4?: string }): Promise<CardDto> {
    const out = await this.request<Record<string, unknown>>('PUT', `/api/v1/cards/${cardId}/activate`, user, body ?? {});
    return mapCard(out);
  }

  async setCardLimit(user: UserContext, cardId: string, limit: number): Promise<CardDto> {
    const out = await this.request<Record<string, unknown>>('PUT', `/api/v1/cards/${cardId}/limit`, user, { limit });
    return mapCard(out);
  }

  /** GET /api/v1/wallet — Unified Balance (WUSD / WEUR) */
  async getWallet(user: UserContext): Promise<WalletBalanceItem[]> {
    const data = await this.request<{ balances?: Array<{ token_symbol?: string; balance?: number; reference_currency?: string; token_address?: string }> }>(
      'GET',
      '/api/v1/wallet',
      user
    );
    return (data.balances ?? []).map((b) => ({
      symbol: b.token_symbol ?? 'WUSD',
      balance: b.balance ?? 0,
      currency: b.reference_currency ?? 'USD',
      token_address: b.token_address,
    }));
  }

  async closeCard(user: UserContext, cardId: string): Promise<CardDto> {
    const out = await this.request<Record<string, unknown>>('PUT', `/api/v1/cards/${cardId}/close`, user);
    return mapCard(out);
  }

  async issueMetalCard(user: UserContext, body?: Record<string, unknown>): Promise<CardDto> {
    const out = await this.request<{ id: string } & Record<string, unknown>>('POST', '/api/v2/cards/metal', user, body ?? {});
    return mapCard({ ...out, type: 'plastic', status: 'inactive' });
  }

  async getVerificationToken(user: UserContext): Promise<string | null> {
    try {
      const out = await this.request<{ token?: string }>('GET', '/api/v1/user/verification-token', user);
      return out.token ?? null;
    } catch {
      try {
        const out = await this.request<{ token?: string }>('POST', '/api/v1/user/verification-token', user, {});
        return out.token ?? null;
      } catch {
        return null;
      }
    }
  }

  async setSharingToken(user: UserContext, sharingToken: string): Promise<unknown> {
    return this.request('POST', '/api/v1/user/sharing-token', user, { sharing_token: sharingToken });
  }

  async getActivityFeed(
    user: UserContext,
    query?: { page_number?: number; page_size?: number; types?: string[]; subject?: string }
  ): Promise<unknown> {
    const q = new URLSearchParams();
    q.set('page_number', String(query?.page_number ?? 0));
    q.set('page_size', String(query?.page_size ?? 25));
    if (query?.subject) q.set('subject', query.subject);
    for (const t of query?.types ?? []) q.append('types', t);
    return this.request('GET', `/api/v2/activity/feed?${q.toString()}`, user);
  }

  async getActivity(user: UserContext, id: string): Promise<unknown> {
    return this.request('GET', `/api/v2/activity/${id}`, user);
  }

  /** ISO/정산 명세서 — Unix timestamp */
  async getFullStatement(user: UserContext, startUnix: number, endUnix: number): Promise<unknown> {
    return this.request('POST', '/api/v1/activity/statement/full', user, { start: startUnix, end: endUnix });
  }

  async list3dsRequests(user: UserContext): Promise<unknown> {
    return this.request('GET', '/api/v1/cards/3ds/requests', user);
  }

  async approve3ds(user: UserContext, transactionId: string): Promise<unknown> {
    return this.request('POST', `/api/v1/cards/3ds/requests/${transactionId}/approve`, user);
  }

  async decline3ds(user: UserContext, transactionId: string): Promise<unknown> {
    return this.request('POST', `/api/v1/cards/3ds/requests/${transactionId}/decline`, user);
  }

  async getValidationRules(): Promise<unknown> {
    return this.request('GET', '/api/v1/validation/rules');
  }

  async createRecipient(user: UserContext, body: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/api/v2/recipients', user, body);
  }

  async listRecipients(user: UserContext): Promise<unknown> {
    return this.request('GET', '/api/v1/recipients', user);
  }

  async listBankAccounts(user: UserContext): Promise<unknown> {
    return this.request('GET', '/api/v1/bank/accounts', user);
  }

  async estimateBankTransfer(user: UserContext, body: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/api/v2/bank/transfer/estimate', user, body);
  }

  async executeBankTransfer(user: UserContext, body: Record<string, unknown>): Promise<unknown> {
    return this.request('POST', '/api/v1/bank/transfer', user, body);
  }

  /**
   * Apple Pay / Google Pay 프로비저닝.
   * 공식 OpenAPI에 전용 경로가 없으면 404 — 호출부에서 로컬 토큰 발급으로 폴백.
   */
  async provisionDigitalWallet(
    user: UserContext,
    cardId: string,
    body: { wallet: 'apple_pay' | 'google_pay'; device_id?: string; certificates?: unknown }
  ): Promise<unknown> {
    return this.request('POST', `/api/v1/cards/${cardId}/digital-wallets`, user, {
      wallet_type: body.wallet === 'apple_pay' ? 'ApplePay' : 'GooglePay',
      device_id: body.device_id,
      certificates: body.certificates,
    });
  }

  /** PCI Push-to-Card 토큰화 (외부 카드). user_id 쿼리 필수 */
  async tokenizeExternalCard(params: {
    userId: string;
    userToken: string;
    card_number: string;
    cardholder_name: string;
    card_label?: string;
    is_third_party?: boolean;
  }): Promise<{ value?: string }> {
    const c = this.cfg();
    const url = `${c.pciBase}/b2b/cards/oct?user_id=${encodeURIComponent(params.userId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.userToken}`,
      },
      body: JSON.stringify({
        card_number: params.card_number,
        cardholder_name: params.cardholder_name,
        card_label: params.card_label ?? 'Card',
        is_saved: true,
        is_third_party: params.is_third_party ?? false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new WirexApiError('PCI tokenization failed', res.status, data);
    }
    return data as { value?: string };
  }

  async authorizeUser(user: UserContext): Promise<string | null> {
    try {
      const out = await this.request<{ access_token?: string; token?: string }>('POST', '/api/v1/user/authorize', user, {});
      return out.access_token ?? out.token ?? null;
    } catch {
      return null;
    }
  }
}

export const wirexClient = new WirexClient();
