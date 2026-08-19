/**
 * Wirex Sandbox Helper API (RAMC)
 * 공식: https://docs.wirexapp.com/docs/sandbox-testing-reference
 * Base: https://ramc.wirexapp.tech  (Production에는 없음)
 *
 * KYC 실검증 없이 토큰 민트, 카드 ISO-8583 결제 시뮬레이션을 수행한다.
 */

import { getWirexBaaSConfig } from '../../config.js';
import { WirexApiError } from './types.js';

export class SandboxHelperClient {
  private base(): string {
    return getWirexBaaSConfig().helperBase;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const c = getWirexBaaSConfig();
    if (c.environment === 'production' || !c.helperBase) {
      throw new WirexApiError('Sandbox Helper is not available in production', 400);
    }
    const res = await fetch(`${this.base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new WirexApiError((data as { error?: string }).error || `Helper ${res.status}`, res.status, data);
    }
    return data as T;
  }

  /**
   * 테스트 토큰 민트 (WUSD 기본: Base Sepolia 0x0774...6976, 18 decimals)
   * amount 는 wei 문자열.
   */
  async mint(params: { to: string; amountWei: string; token?: string; chainId?: string }): Promise<{ txHash?: string; success?: boolean }> {
    const c = getWirexBaaSConfig();
    return this.post('/account/retail/mint', {
      chainId: params.chainId ?? String(c.chainId),
      token: params.token ?? c.wusdToken,
      to: params.to,
      amount: params.amountWei,
    });
  }

  /** 가상 KYC 후 잔액 확보용: 1 WUSD = 10^18 */
  async mintWusd(to: string, wholeTokens = 100): Promise<{ txHash?: string; success?: boolean }> {
    const wei = BigInt(wholeTokens) * 10n ** 18n;
    return this.mint({ to, amountWei: wei.toString() });
  }

  async sepaDeposit(email: string, amount: number): Promise<{ success?: boolean }> {
    return this.post('/bank/sepa/deposit', { region: 'GB', email, amount });
  }

  /** 매장 결제: 승인 + 정산 (웹훅 /v2/webhooks/activities CardTransaction) */
  async cardAuthAndClearing(params: {
    cardId: string;
    amount: number;
    currency?: string;
    merchantCountry?: string;
  }): Promise<unknown> {
    const currency = params.currency ?? 'USD';
    return this.post('/card/auth-and-clearing', {
      cardId: params.cardId,
      amount: params.amount,
      currency,
      settlementAmount: params.amount,
      settlementCurrency: currency,
      merchantCountry: params.merchantCountry ?? 'USA',
      paymentProvider: 'Visa',
    });
  }

  async cardEposAuthAndClearing(params: { cardId: string; amount: number; currency?: string }): Promise<unknown> {
    const currency = params.currency ?? 'USD';
    return this.post('/card/epos-auth-and-clearing', {
      cardId: params.cardId,
      amount: params.amount,
      currency,
      settlementAmount: params.amount,
      settlementCurrency: currency,
      paymentProvider: 'Visa',
    });
  }
}

export const sandboxHelper = new SandboxHelperClient();
