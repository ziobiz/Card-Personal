/**
 * 기존 import 호환 래퍼 — 실제 호출은 테넌트 스코프 WirexClient
 * API/서브솔루션 → HQ 키. 단독형 → 해당 업체의 Wirex 계약 키.
 */

import { wirexClient } from '../../clients/wirex/WirexClient.js';
import { wirexClientFromContext } from '../../clients/wirex/wirexClients.js';
import type { UserContext } from '../../clients/wirex/types.js';

function c(user?: UserContext) {
  return user ? wirexClientFromContext(user) : wirexClient;
}

export const wirexBaaSClient = {
  isConfigured: () => Promise.resolve(wirexClient.isConfigured()),
  registerUser: (data: { wallet_address: string; email: string; country: string }) =>
    c({ email: data.email, walletAddress: data.wallet_address }).registerUser(data).catch(() => null),
  getVerificationLink: (user: UserContext) =>
    c(user).getVerificationLink(user).catch(() => null),
  getCards: (user: UserContext, page = 1, size = 10) =>
    c(user).getCards(user, page, size).catch(() => null),
  getCard: (user: UserContext, cardId: string) =>
    c(user).getCard(user, cardId).catch(() => null),
  createVirtualCard: (user: UserContext, options?: { limit?: number; currency?: string; card_name?: string; name_on_card?: string }) =>
    c(user).issueVirtualCard(user, {
      card_name: options?.card_name,
      name_on_card: options?.name_on_card,
    }).catch(() => null),
  createPlasticCard: (user: UserContext, body: { card_name?: string; name_on_card?: string; delivery_address?: Record<string, unknown> }) =>
    c(user).issuePlasticCard(user, body).catch(() => null),
  blockCard: (cardId: string, user: UserContext) =>
    c(user).blockCard(user, cardId).catch(() => null),
  unblockCard: (cardId: string, user: UserContext) =>
    c(user).unblockCard(user, cardId).catch(() => null),
  setCardLimit: (cardId: string, limit: number, user: UserContext) =>
    c(user).setCardLimit(user, cardId, limit).catch(() => null),
  activateCard: (cardId: string, user: UserContext, body?: { last4?: string }) =>
    c(user).activateCard(user, cardId, body).catch(() => null),
  closeCard: (cardId: string, user: UserContext) =>
    c(user).closeCard(user, cardId).catch(() => null),
  getWalletBalance: (user: UserContext) =>
    c(user).getWallet(user).catch(() => null),
};
