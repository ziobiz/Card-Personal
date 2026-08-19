/**
 * Wirex BaaS 공식 타입 (docs.wirexapp.com)
 * Co-Branded Visa = 사용자 AA 월렛에 연결된 virtual/plastic 카드
 */

export type UserContext = {
  userId?: string;
  email?: string;
  /** EOA 서명자 주소 — 문서 표준 헤더 X-User-Wallet */
  walletAddress?: string;
};

export class WirexApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'WirexApiError';
  }
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_at: number;
}

export interface CardDto {
  id: string;
  type: 'virtual' | 'plastic';
  status: 'inactive' | 'active' | 'blocked' | 'closed';
  panLast4: string;
  expiryMonth: string;
  expiryYear: string;
  currency: string;
  limit?: number;
  dailyLimit?: number;
  dailyUsed?: number;
  balance?: number;
  createdAt: string;
}

export interface WalletBalanceItem {
  symbol: string;
  balance: number;
  currency: string;
  token_address?: string;
}
