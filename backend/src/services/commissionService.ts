/**
 * 영업조직 수수료 배분 — 가맹점(파트너) 발생 수수료를 상위 조직에 배분
 */

import { orgStore, type OrgLevel } from '../data/orgStore.js';
import { partnerStore } from '../data/partnerStore.js';
import { RATE_BY_LEVEL, type DistributionRates } from '../data/salesFeePolicyStore.js';
import { resolvePartnerPolicy } from '../data/feePolicyTemplateStore.js';
import { transactionStore } from '../data/transactionStore.js';

export interface CommissionSplit {
  orgUnitId: string;
  orgLevel: OrgLevel;
  orgName: string;
  rate: number;
  amount: number;
}

export const commissionService = {
  split(partnerId: string, feeAmount: number): CommissionSplit[] {
    if (feeAmount <= 0) return [];
    const partner = partnerStore.getById(partnerId);
    const dist: DistributionRates = resolvePartnerPolicy(partner).distribution;
    const startId = partner?.orgUnitId;
    const chain = orgStore.chain(startId).filter((u) => u.orgLevel !== 'MERCHANT');
    const splits: CommissionSplit[] = [];
    let used = 0;
    for (const unit of chain) {
      if (unit.orgLevel === 'MERCHANT') continue;
      const key = RATE_BY_LEVEL[unit.orgLevel as Exclude<OrgLevel, 'MERCHANT'>];
      if (!key) continue;
      const rate = Number(dist[key] ?? 0);
      const amount = Math.round(feeAmount * rate) / 100;
      if (amount <= 0) continue;
      used += amount;
      splits.push({
        orgUnitId: unit.id,
        orgLevel: unit.orgLevel,
        orgName: unit.name,
        rate,
        amount,
      });
    }
    const remainder = Math.round((feeAmount - used) * 100) / 100;
    const hq = orgStore.get('org_hq');
    if (remainder > 0 && hq && !splits.some((s) => s.orgUnitId === hq.id)) {
      splits.push({
        orgUnitId: hq.id,
        orgLevel: 'HEADQUARTERS',
        orgName: hq.name,
        rate: 0,
        amount: remainder,
      });
    } else if (remainder > 0 && hq) {
      const row = splits.find((s) => s.orgUnitId === hq.id);
      if (row) row.amount = Math.round((row.amount + remainder) * 100) / 100;
    }
    return splits;
  },

  record(partnerId: string, feeAmount: number, feeType: string, userId?: string): CommissionSplit[] {
    const splits = this.split(partnerId, feeAmount);
    if (!splits.length) return splits;
    transactionStore.add({
      type: 'commission',
      partnerId,
      userId,
      amount: feeAmount,
      fee: feeAmount,
      currency: 'USD',
      status: 'completed',
      metadata: { feeType, splits },
    });
    return splits;
  },
};
