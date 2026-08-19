/**
 * 수수료 정책 - settingsStore에서 로드
 */

import { settingsStore } from './settingsStore.js';
import { partnerStore } from './partnerStore.js';
import { resolvePartnerPolicy } from './feePolicyTemplateStore.js';

export interface FeePolicy {
  treasuryWalletAddress: string;
  cardIssuanceFee: number;
  cardTopUpFeePercent: number;
  cardUsageFeePerTransaction: number;
  cardMonthlyFee: number;
  partnerMonthlyFee: number;
}

const DEFAULTS: FeePolicy = {
  treasuryWalletAddress: '',
  cardIssuanceFee: 5,
  cardTopUpFeePercent: 0.5,
  cardUsageFeePerTransaction: 0.1,
  cardMonthlyFee: 2,
  partnerMonthlyFee: 50,
};

export const feeSettings = {
  get(): FeePolicy {
    const p = settingsStore.get().feePolicy ?? {};
    const hq = resolvePartnerPolicy().fees;
    return {
      treasuryWalletAddress: p.treasuryWalletAddress ?? DEFAULTS.treasuryWalletAddress,
      cardIssuanceFee: hq.cardIssuanceFee,
      cardTopUpFeePercent: hq.cardTopUpFeePercent,
      cardUsageFeePerTransaction: hq.cardUsageFeePerTransaction,
      cardMonthlyFee: hq.cardMonthlyFee,
      partnerMonthlyFee: hq.partnerMonthlyFee,
    };
  },

  /** 파트너별 요금. 직접변경 > 선택정책 > 총본사 */
  getForPartner(partnerId?: string): FeePolicy {
    const base = this.get();
    if (!partnerId) return base;
    const resolved = resolvePartnerPolicy(partnerStore.getById(partnerId));
    return {
      treasuryWalletAddress: base.treasuryWalletAddress,
      cardIssuanceFee: resolved.fees.cardIssuanceFee,
      cardTopUpFeePercent: resolved.fees.cardTopUpFeePercent,
      cardUsageFeePerTransaction: resolved.fees.cardUsageFeePerTransaction,
      cardMonthlyFee: resolved.fees.cardMonthlyFee,
      partnerMonthlyFee: resolved.fees.partnerMonthlyFee,
    };
  },
};
