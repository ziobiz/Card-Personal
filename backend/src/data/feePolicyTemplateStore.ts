/**
 * 수수료 정책 템플릿 (총본사 기본 + 사전 생성 정책)
 * 우선순위: 파트너 직접 변경 > 선택한 정책 > 총본사 기본
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { salesFeePolicyStore, type DefaultFeePolicy, type DistributionRates } from './salesFeePolicyStore.js';
import type { Partner, PartnerFeePolicy } from './partnerStore.js';

export interface FeeAmounts {
  cardIssuanceFee: number;
  cardTopUpFeePercent: number;
  cardUsageFeePerTransaction: number;
  cardMonthlyFee: number;
  partnerMonthlyFee: number;
  plasticIssuanceFee: number;
}

export interface FeePolicyTemplate {
  id: string;
  name: string;
  description?: string;
  isHqDefault: boolean;
  fees: FeeAmounts;
  distribution: DistributionRates;
  createdAt: string;
  updatedAt?: string;
}

export type FeeSource = 'custom' | 'template' | 'hq';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'fee_policy_templates.json');
export const HQ_TEMPLATE_ID = 'tpl_hq';

function fromSales(): { fees: FeeAmounts; distribution: DistributionRates } {
  const s = salesFeePolicyStore.get();
  return {
    fees: {
      cardIssuanceFee: s.cardIssuanceFee,
      cardTopUpFeePercent: s.cardTopUpFeePercent,
      cardUsageFeePerTransaction: s.cardUsageFeePerTransaction,
      cardMonthlyFee: s.cardMonthlyFee,
      partnerMonthlyFee: s.partnerMonthlyFee,
      plasticIssuanceFee: s.plasticIssuanceFee,
    },
    distribution: { ...s.distribution },
  };
}

function seed(): FeePolicyTemplate[] {
  const base = fromSales();
  const now = new Date().toISOString();
  return [
    {
      id: HQ_TEMPLATE_ID,
      name: '총본사 기본 정책',
      description: '미설정 파트너가 따르는 총본사 정책',
      isHqDefault: true,
      fees: base.fees,
      distribution: base.distribution,
      createdAt: now,
    },
    {
      id: 'tpl_promo',
      name: '프로모션',
      description: '한시 할인 요금',
      isHqDefault: false,
      fees: {
        cardIssuanceFee: 2,
        cardTopUpFeePercent: 0.2,
        cardUsageFeePerTransaction: 0.05,
        cardMonthlyFee: 1,
        partnerMonthlyFee: 20,
        plasticIssuanceFee: 8,
      },
      distribution: { ...base.distribution },
      createdAt: now,
    },
    {
      id: 'tpl_premium',
      name: '프리미엄',
      description: '실물·고한도 파트너용',
      isHqDefault: false,
      fees: {
        cardIssuanceFee: 8,
        cardTopUpFeePercent: 0.8,
        cardUsageFeePerTransaction: 0.2,
        cardMonthlyFee: 4,
        partnerMonthlyFee: 80,
        plasticIssuanceFee: 20,
      },
      distribution: { ...base.distribution },
      createdAt: now,
    },
  ];
}

function load(): FeePolicyTemplate[] {
  if (!existsSync(FILE)) {
    const s = seed();
    writeFileSync(FILE, JSON.stringify({ templates: s }, null, 2), 'utf-8');
    return s;
  }
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8'));
    const list: FeePolicyTemplate[] = parsed.templates ?? [];
    if (!list.some((t) => t.isHqDefault)) {
      const extra = seed()[0];
      list.unshift(extra);
      save(list);
    }
    return list;
  } catch {
    return seed();
  }
}

function save(list: FeePolicyTemplate[]) {
  writeFileSync(FILE, JSON.stringify({ templates: list }, null, 2), 'utf-8');
}

let cached = load();

function syncHqToSales(hq: FeePolicyTemplate) {
  salesFeePolicyStore.update({
    ...hq.fees,
    distribution: hq.distribution,
  } as Partial<DefaultFeePolicy>);
}

export function resolvePartnerPolicy(partner?: Partner | null): {
  fees: FeeAmounts;
  distribution: DistributionRates;
  source: FeeSource;
  templateId: string;
  templateName: string;
} {
  const hq = cached.find((t) => t.isHqDefault) ?? cached[0];
  const chosen =
    partner?.feePolicyId && partner.feePolicyId !== HQ_TEMPLATE_ID
      ? cached.find((t) => t.id === partner.feePolicyId)
      : undefined;
  const tpl = chosen ?? hq;
  const feesBase = { ...hq.fees, ...(tpl?.fees ?? {}) };
  const distBase = { ...hq.distribution, ...(tpl?.distribution ?? {}) };
  const overridden = Boolean(partner?.feeOverride && partner.fees && Object.keys(partner.fees).length);
  const fees: FeeAmounts = overridden
    ? {
        ...feesBase,
        ...partner!.fees,
        plasticIssuanceFee: partner!.fees?.plasticIssuanceFee ?? feesBase.plasticIssuanceFee,
      }
    : feesBase;
  const dist =
    partner?.distribution && Object.keys(partner.distribution).length
      ? { ...distBase, ...partner.distribution }
      : distBase;
  const source: FeeSource = overridden ? 'custom' : chosen ? 'template' : 'hq';
  return {
    fees,
    distribution: dist,
    source,
    templateId: tpl.id,
    templateName: tpl.name,
  };
}

export const feePolicyTemplateStore = {
  list(): FeePolicyTemplate[] {
    return cached.map((t) => ({ ...t, fees: { ...t.fees }, distribution: { ...t.distribution } }));
  },

  get(id: string): FeePolicyTemplate | undefined {
    return cached.find((t) => t.id === id);
  },

  getHq(): FeePolicyTemplate {
    return cached.find((t) => t.isHqDefault) ?? cached[0];
  },

  create(data: { name: string; description?: string; fees?: Partial<FeeAmounts>; distribution?: Partial<DistributionRates> }): FeePolicyTemplate {
    const hq = this.getHq();
    const item: FeePolicyTemplate = {
      id: 'tpl_' + randomBytes(6).toString('hex'),
      name: data.name.trim() || '새 정책',
      description: data.description?.trim(),
      isHqDefault: false,
      fees: { ...hq.fees, ...(data.fees ?? {}) },
      distribution: { ...hq.distribution, ...(data.distribution ?? {}) },
      createdAt: new Date().toISOString(),
    };
    cached = [...cached, item];
    save(cached);
    return item;
  },

  update(id: string, data: Partial<Pick<FeePolicyTemplate, 'name' | 'description' | 'fees' | 'distribution' | 'isHqDefault'>>): FeePolicyTemplate | undefined {
    const idx = cached.findIndex((t) => t.id === id);
    if (idx < 0) return undefined;
    const next: FeePolicyTemplate = {
      ...cached[idx],
      updatedAt: new Date().toISOString(),
    };
    if (typeof data.name === 'string' && data.name.trim()) next.name = data.name.trim();
    if (data.description !== undefined) next.description = data.description;
    if (data.fees) next.fees = { ...next.fees, ...data.fees };
    if (data.distribution) next.distribution = { ...next.distribution, ...data.distribution };
    if (data.isHqDefault === true) {
      cached = cached.map((t, i) => ({ ...(i === idx ? next : t), isHqDefault: t.id === id }));
    } else {
      cached[idx] = next;
    }
    save(cached);
    const saved = cached.find((t) => t.id === id)!;
    if (saved.isHqDefault) syncHqToSales(saved);
    return saved;
  },

  remove(id: string): boolean {
    const t = cached.find((x) => x.id === id);
    if (!t || t.isHqDefault) return false;
    cached = cached.filter((x) => x.id !== id);
    save(cached);
    return true;
  },
};
