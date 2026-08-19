/**
 * 기존 import 호환 래퍼 — 실제 호출은 WirexClient 사용
 */

import { wirexClient } from '../../clients/wirex/WirexClient.js';
import type { UserContext } from '../../clients/wirex/types.js';

export const wirexBaaSClient = {
  isConfigured: () => Promise.resolve(wirexClient.isConfigured()),
  registerUser: (data: { wallet_address: string; email: string; country: string }) =>
    wirexClient.registerUser(data).catch(() => null),
  getVerificationLink: (user: UserContext) =>
    wirexClient.getVerificationLink(user).catch(() => null),
  getCards: (user: UserContext, page = 1, size = 10) =>
    wirexClient.getCards(user, page, size).catch(() => null),
  getCard: (user: UserContext, cardId: string) =>
    wirexClient.getCard(user, cardId).catch(() => null),
  createVirtualCard: (user: UserContext, options?: { limit?: number; currency?: string; card_name?: string; name_on_card?: string }) =>
    wirexClient.issueVirtualCard(user, {
      card_name: options?.card_name,
      name_on_card: options?.name_on_card,
    }).catch(() => null),
  createPlasticCard: (user: UserContext, body: { card_name?: string; name_on_card?: string; delivery_address?: Record<string, unknown> }) =>
    wirexClient.issuePlasticCard(user, body).catch(() => null),
  blockCard: (cardId: string, user: UserContext) =>
    wirexClient.blockCard(user, cardId).catch(() => null),
  unblockCard: (cardId: string, user: UserContext) =>
    wirexClient.unblockCard(user, cardId).catch(() => null),
  setCardLimit: (cardId: string, limit: number, user: UserContext) =>
    wirexClient.setCardLimit(user, cardId, limit).catch(() => null),
  activateCard: (cardId: string, user: UserContext, body?: { last4?: string }) =>
    wirexClient.activateCard(user, cardId, body).catch(() => null),
  closeCard: (cardId: string, user: UserContext) =>
    wirexClient.closeCard(user, cardId).catch(() => null),
  getWalletBalance: (user: UserContext) =>
    wirexClient.getWallet(user).catch(() => null),
};
