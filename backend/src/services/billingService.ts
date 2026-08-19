/**
 * 수수료 및 과금 서비스
 * 충전·사용 시 특정 월렛으로 수수료 자동 이체 (기록)
 */

import { config } from '../config.js';
import { feeSettings } from '../data/feeSettings.js';
import { transactionStore } from '../data/transactionStore.js';
import { mockWirex } from './wirex/mockWirex.js';

async function deductFee(wirexUserId: string, amountUsd: number): Promise<boolean> {
  if (!config.useMockWirex) return true;
  return mockWirex.deductFromPrimary(wirexUserId, amountUsd, 'WUSD');
}

export const billingService = {
  async applyCardIssueFee(userId: string, wirexUserId: string, partnerId?: string): Promise<{ ok: boolean; fee: number }> {
    const policy = feeSettings.getForPartner(partnerId);
    const fee = policy.cardIssuanceFee;
    if (fee <= 0 || !policy.treasuryWalletAddress) {
      return { ok: true, fee: 0 };
    }
    const ok = await deductFee(wirexUserId, fee);
    if (!ok) return { ok: false, fee };
    transactionStore.add({
      type: 'fee',
      userId,
      partnerId,
      amount: 0,
      fee,
      currency: 'USD',
      status: 'completed',
      metadata: { feeType: 'card_issue', treasury: policy.treasuryWalletAddress },
    });
    if (partnerId) {
      const { commissionService } = await import('./commissionService.js');
      commissionService.record(partnerId, fee, 'card_issue', userId);
    }
    return { ok: true, fee };
  },

  async applyCardTopUpFee(userId: string, wirexUserId: string, amount: number, partnerId?: string): Promise<{ ok: boolean; fee: number }> {
    const policy = feeSettings.getForPartner(partnerId);
    const fee = policy.treasuryWalletAddress ? (amount * policy.cardTopUpFeePercent) / 100 : 0;
    const totalDeduct = amount + fee;
    const ok = await deductFee(wirexUserId, totalDeduct);
    if (!ok) return { ok: false, fee };
    if (fee > 0) {
      transactionStore.add({
        type: 'fee',
        userId,
        partnerId,
        amount,
        fee,
        currency: 'USD',
        status: 'completed',
        metadata: { feeType: 'card_topup', treasury: policy.treasuryWalletAddress },
      });
    }
    if (partnerId && fee > 0) {
      const { commissionService } = await import('./commissionService.js');
      commissionService.record(partnerId, fee, 'card_topup', userId);
    }
    return { ok: true, fee };
  },

  async recordCardUsage(cardId: string, userId: string, wirexUserId: string, amount: number, status: 'success' | 'failed', partnerId?: string): Promise<void> {
    const policy = feeSettings.getForPartner(partnerId);
    const fee = status === 'success' ? policy.cardUsageFeePerTransaction : 0;
    if (fee > 0 && policy.treasuryWalletAddress) {
      await deductFee(wirexUserId, fee);
    }
    transactionStore.add({
      type: 'card_usage',
      userId,
      partnerId,
      cardId,
      amount,
      fee,
      currency: 'USD',
      status: status === 'success' ? 'completed' : 'failed',
      metadata: { cardUsageStatus: status },
    });
  },

  recordP2P(fromUserId: string, toUserId: string, amount: number, fee = 0): void {
    transactionStore.add({
      type: 'p2p',
      fromUserId,
      toUserId,
      amount,
      fee,
      currency: 'USD',
      status: 'completed',
    });
  },

  recordRefund(userId: string, amount: number, fee: number, partnerId?: string): void {
    transactionStore.add({
      type: 'refund',
      userId,
      partnerId,
      amount,
      fee,
      currency: 'USD',
      status: 'completed',
      metadata: { feeType: 'refund' },
    });
  },
};
