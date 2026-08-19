/**
 * Wirex 통합 서비스 - Real BaaS 우선, 실패 시 Mock 사용
 * 카드 발급은 API를 통해 Wirex 시스템으로 처리
 */

import type { WirexCard, WirexUser, TokenBalance } from '../../types.js';
import { wirexBaaSClient } from './wirexBaaSClient.js';
import { mockWirex } from './mockWirex.js';
import { config } from '../../config.js';
import { store } from '../../data/store.js';

type UserContext = { userId?: string; email?: string; walletAddress?: string };

/** Wirex user id 로 로컬 매핑을 찾아 X-User-Wallet 헤더를 채운다 */
function userCtx(wirexUserId?: string, email?: string, walletAddress?: string): UserContext {
  const mapped = wirexUserId ? store.getUserByWirexUserId(wirexUserId) : undefined;
  const ctx: UserContext = {};
  const wallet = walletAddress ?? mapped?.walletAddress;
  const mail = email ?? mapped?.email;
  if (wallet) ctx.walletAddress = wallet;
  if (wirexUserId) ctx.userId = wirexUserId;
  if (mail) ctx.email = mail;
  return ctx;
}

export const wirexService = {
  async createUser(data: { email: string; phone?: string; wallet_address?: string; country?: string }): Promise<WirexUser> {
    if (config.useMockWirex) {
      return mockWirex.createUser(data);
    }
    if (!data.wallet_address) {
      return mockWirex.createUser(data);
    }
    const token = await wirexBaaSClient.registerUser({
      wallet_address: data.wallet_address,
      email: data.email,
      country: data.country ?? 'GB',
    });
    if (token) {
      return {
        id: token.id,
        email: data.email,
        status: 'pending',
        primaryWalletAddress: data.wallet_address,
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

  async getCard(cardId: string, userId?: string): Promise<WirexCard | null> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex && userId) {
      const card = await wirexBaaSClient.getCard(ctx, cardId);
      if (card) return { ...card, userId } as WirexCard;
    }
    return mockWirex.getCard(cardId);
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

  async createPlasticCard(
    userId: string,
    data: { card_name?: string; name_on_card?: string; delivery_address?: Record<string, unknown> }
  ): Promise<WirexCard> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex) {
      const card = await wirexBaaSClient.createPlasticCard(ctx, data);
      if (card) {
        return {
          id: card.id,
          userId,
          type: 'plastic',
          status: (card.status as WirexCard['status']) ?? 'inactive',
          panLast4: card.panLast4 ?? '****',
          expiryMonth: card.expiryMonth ?? '**',
          expiryYear: card.expiryYear ?? '**',
          currency: card.currency ?? 'USD',
          createdAt: card.createdAt ?? new Date().toISOString(),
        };
      }
    }
    const virtual = await mockWirex.createVirtualCard(userId, {});
    return { ...virtual, type: 'plastic', status: 'inactive' };
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

  async activateCard(cardId: string, data?: { last4?: string }, userId?: string): Promise<WirexCard> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex && userId) {
      const card = await wirexBaaSClient.activateCard(cardId, ctx, data);
      if (card) {
        return { ...card, userId } as WirexCard;
      }
    }
    return mockWirex.activateCard(cardId, data);
  },

  async closeCard(cardId: string, userId?: string): Promise<WirexCard> {
    const ctx = userCtx(userId);
    if (!config.useMockWirex && userId) {
      const card = await wirexBaaSClient.closeCard(cardId, ctx);
      if (card) return { ...card, userId } as WirexCard;
    }
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
