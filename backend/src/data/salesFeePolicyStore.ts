/**
 * 기본 수수료 정책 + 영업조직 배분율 (ziobiz/PG DistributionFeeConfig)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { OrgLevel } from './orgStore.js';

export interface DistributionRates {
  hqRate: number;
  regionalRate: number;
  masterRate: number;
  branchRate: number;
  agencyRate: number;
  salesOfficeRate: number;
  hqPerTxFee: number;
  regionalPerTxFee: number;
  masterPerTxFee: number;
  branchPerTxFee: number;
  agencyPerTxFee: number;
  salesOfficePerTxFee: number;
}

export interface DefaultFeePolicy {
  cardIssuanceFee: number;
  cardTopUpFeePercent: number;
  cardUsageFeePerTransaction: number;
  cardMonthlyFee: number;
  partnerMonthlyFee: number;
  plasticIssuanceFee: number;
  distribution: DistributionRates;
}

const DEFAULTS: DefaultFeePolicy = {
  cardIssuanceFee: 5,
  cardTopUpFeePercent: 0.5,
  cardUsageFeePerTransaction: 0.1,
  cardMonthlyFee: 2,
  partnerMonthlyFee: 50,
  plasticIssuanceFee: 15,
  distribution: {
    hqRate: 40,
    regionalRate: 20,
    masterRate: 15,
    branchRate: 10,
    agencyRate: 10,
    salesOfficeRate: 5,
    hqPerTxFee: 0,
    regionalPerTxFee: 0,
    masterPerTxFee: 0,
    branchPerTxFee: 0,
    agencyPerTxFee: 0,
    salesOfficePerTxFee: 0,
  },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'sales_fee_policy.json');

function load(): DefaultFeePolicy {
  if (!existsSync(FILE)) return { ...DEFAULTS, distribution: { ...DEFAULTS.distribution } };
  try {
    const p = JSON.parse(readFileSync(FILE, 'utf-8'));
    return {
      ...DEFAULTS,
      ...p,
      distribution: { ...DEFAULTS.distribution, ...(p.distribution ?? {}) },
    };
  } catch {
    return { ...DEFAULTS, distribution: { ...DEFAULTS.distribution } };
  }
}

function save(p: DefaultFeePolicy) {
  writeFileSync(FILE, JSON.stringify(p, null, 2), 'utf-8');
}

let cached = load();

export const RATE_BY_LEVEL: Record<Exclude<OrgLevel, 'MERCHANT'>, keyof DistributionRates> = {
  HEADQUARTERS: 'hqRate',
  REGIONAL: 'regionalRate',
  MASTER_DIST: 'masterRate',
  BRANCH: 'branchRate',
  AGENCY: 'agencyRate',
  SALES_OFFICE: 'salesOfficeRate',
};

export const salesFeePolicyStore = {
  get(): DefaultFeePolicy {
    return cached;
  },
  update(partial: Partial<DefaultFeePolicy> & { distribution?: Partial<DistributionRates> }): DefaultFeePolicy {
    cached = {
      ...cached,
      ...partial,
      distribution: { ...cached.distribution, ...(partial.distribution ?? {}) },
    };
    save(cached);
    return cached;
  },
};
