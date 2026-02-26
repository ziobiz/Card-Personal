/**
 * 수수료 정책 - settingsStore에서 로드
 */

import { settingsStore } from './settingsStore.js';

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
    return {
      treasuryWalletAddress: p.treasuryWalletAddress ?? DEFAULTS.treasuryWalletAddress,
      cardIssuanceFee: p.cardIssuanceFee ?? DEFAULTS.cardIssuanceFee,
      cardTopUpFeePercent: p.cardTopUpFeePercent ?? DEFAULTS.cardTopUpFeePercent,
      cardUsageFeePerTransaction: p.cardUsageFeePerTransaction ?? DEFAULTS.cardUsageFeePerTransaction,
      cardMonthlyFee: p.cardMonthlyFee ?? DEFAULTS.cardMonthlyFee,
      partnerMonthlyFee: p.partnerMonthlyFee ?? DEFAULTS.partnerMonthlyFee,
    };
  },
};
