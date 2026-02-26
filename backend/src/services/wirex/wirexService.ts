/**
 * Wirex 통합 서비스 - Real BaaS 우선, 실패 시 Mock 사용
 * 카드 발급은 API를 통해 Wirex 시스템으로 처리
 */

import type { WirexCard, WirexUser, TokenBalance } from '../../types.js';
import { wirexBaaSClient } from './wirexBaaSClient.js';
import { mockWirex } from './mockWirex.js';
import { config } from '../../config.js';

type UserContext = { userId?: string; email?: string; walletAddress?: string };

function userCtx(userId?: string, email?: string): UserContext {
  if (userId) return { userId };
  if (email) return { email };
  return {};
}

export const wirexService = {
  async createUser(data: { email: string; phone?: string }): Promise<WirexUser> {
    if (config.useMockWirex) {
      return mockWirex.createUser(data);
    }
    const token = await wirexBaaSClient.registerUser({
      wallet_address: '0x' + '0'.repeat(40),
      email: data.email,
      country: 'KR',
    });
    if (token) {
      return {
        id: token.id,
        email: data.email,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    }
    return mockWirex.createUser(data);
  },

  async getCards(userId: string, page = 1, size = 10): Promise<{ items: WirexCard[]; total: number }> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex) {
      const result = await wirexBaaSClient.getCards(ctx, page, size);
      if (result) {
        return {
          items: result.items as WirexCard[],
          total: result.total,
        };
      }
    }
    return mockWirex.getCards(userId, page, size);
  },

  async createVirtualCard(userId: string, data?: { limit?: number; currency?: string }): Promise<WirexCard> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex) {
      const card = await wirexBaaSClient.createVirtualCard(ctx, data);
      if (card) {
        return {
          id: card.id,
          userId,
          type: 'virtual',
          status: (card.status as WirexCard['status']) ?? 'active',
          panLast4: card.panLast4 ?? '****',
          expiryMonth: card.expiryMonth ?? '**',
          expiryYear: card.expiryYear ?? '**',
          currency: card.currency ?? 'USD',
          dailyLimit: card.dailyLimit ?? card.limit ?? data?.limit,
          dailyUsed: card.dailyUsed ?? 0,
          balance: card.balance ?? 0,
          createdAt: card.createdAt ?? new Date().toISOString(),
        };
      }
    }
    return mockWirex.createVirtualCard(userId, data);
  },

  async blockCard(cardId: string, userId?: string): Promise<WirexCard> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex && userId) {
      const card = await wirexBaaSClient.blockCard(cardId, ctx);
      if (card) {
        return { ...card, userId } as WirexCard;
      }
    }
    return mockWirex.blockCard(cardId);
  },

  async unblockCard(cardId: string, userId?: string): Promise<WirexCard> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex && userId) {
      const card = await wirexBaaSClient.unblockCard(cardId, ctx);
      if (card) {
        return { ...card, userId } as WirexCard;
      }
    }
    return mockWirex.unblockCard(cardId);
  },

  async setCardLimit(cardId: string, data: { limit: number }, userId?: string): Promise<WirexCard> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex && userId) {
      const card = await wirexBaaSClient.setCardLimit(cardId, data.limit, ctx);
      if (card) {
        return { ...card, userId } as WirexCard;
      }
    }
    return mockWirex.setCardLimit(cardId, data);
  },

  async closeCard(cardId: string): Promise<WirexCard> {
    return mockWirex.closeCard(cardId);
  },

  async getPrimaryWalletBalance(userId: string): Promise<TokenBalance[]> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex) {
      const balances = await wirexBaaSClient.getWalletBalance(ctx);
      if (balances && balances.length > 0) {
        return balances.map((b) => ({
          symbol: b.symbol,
          name: b.symbol,
          balance: b.balance,
          decimals: 18,
        }));
      }
    }
    return mockWirex.getPrimaryWalletBalance(userId);
  },

  async getCardWallet(cardId: string): Promise<{ address: string; balance: number; currency: string } | null> {
    return mockWirex.getCardWallet(cardId);
  },

  async depositToCard(cardId: string, amountUsd: number, tokenSymbol?: string): Promise<{ success: boolean; newBalance: number }> {
    return mockWirex.depositToCard(cardId, amountUsd, tokenSymbol);
  },

  getSupportedTokens() {
    return mockWirex.getSupportedTokens();
  },

  async getVerificationLink(userId?: string, email?: string): Promise<string | null> {
    if (config.useMockWirex) return null;
    return wirexBaaSClient.getVerificationLink(userCtx(userId, email));
  },
};
