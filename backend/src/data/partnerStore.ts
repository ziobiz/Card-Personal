/**
 * 파트너(타 업체) 저장소 - API Key 관리
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, createHash } from 'crypto';

export interface PartnerFeePolicy {
  cardIssuanceFee?: number;
  cardTopUpFeePercent?: number;
  cardUsageFeePerTransaction?: number;
  cardMonthlyFee?: number;
  partnerMonthlyFee?: number;
  plasticIssuanceFee?: number;
}

export type CardIssuePolicy = 'ALL' | 'VIRTUAL' | 'PLASTIC' | 'STOPPED';

export function flagsFromIssuePolicy(policy: CardIssuePolicy): { allowVirtual: boolean; allowPlastic: boolean } {
  switch (policy) {
    case 'ALL':
      return { allowVirtual: true, allowPlastic: true };
    case 'VIRTUAL':
      return { allowVirtual: true, allowPlastic: false };
    case 'PLASTIC':
      return { allowVirtual: false, allowPlastic: true };
    case 'STOPPED':
      return { allowVirtual: false, allowPlastic: false };
    default:
      return { allowVirtual: true, allowPlastic: true };
  }
}

export function issuePolicyFromPartner(p: { cardIssuePolicy?: string; allowVirtual?: boolean; allowPlastic?: boolean }): CardIssuePolicy {
  if (p.cardIssuePolicy === 'ALL' || p.cardIssuePolicy === 'VIRTUAL' || p.cardIssuePolicy === 'PLASTIC' || p.cardIssuePolicy === 'STOPPED') {
    return p.cardIssuePolicy;
  }
  const v = p.allowVirtual !== false;
  const pl = p.allowPlastic === true;
  if (v && pl) return 'ALL';
  if (v) return 'VIRTUAL';
  if (pl) return 'PLASTIC';
  return 'STOPPED';
}

export function parseCardIssuePolicy(raw: unknown): CardIssuePolicy | undefined {
  if (raw === 'ALL' || raw === 'VIRTUAL' || raw === 'PLASTIC' || raw === 'STOPPED') return raw;
  return undefined;
}

export function canIssueCard(
  partner: { cardIssuePolicy?: string; allowVirtual?: boolean; allowPlastic?: boolean } | undefined,
  type: 'virtual' | 'plastic',
): { ok: true } | { ok: false; error: string } {
  if (!partner) return { ok: true };
  const policy = issuePolicyFromPartner(partner);
  if (policy === 'STOPPED') {
    return { ok: false, error: 'Card issuance is stopped for this merchant' };
  }
  if (type === 'virtual' && !flagsFromIssuePolicy(policy).allowVirtual) {
    return { ok: false, error: 'Virtual card issuance is not enabled for this merchant' };
  }
  if (type === 'plastic' && !flagsFromIssuePolicy(policy).allowPlastic) {
    return { ok: false, error: 'Physical card issuance is not enabled for this merchant' };
  }
  return { ok: true };
}

export interface Partner {
  id: string;
  name: string;
  companyName?: string;
  businessNo?: string;
  ceoName?: string;
  phone?: string;
  orgUnitId?: string;
  orgParentId?: string;
  cardIssuePolicy: CardIssuePolicy;
  allowVirtual: boolean;
  allowPlastic: boolean;
  apiKeyHash: string;
  apiKeyPrefix: string;
  status: 'active' | 'suspended';
  billingWalletAddress?: string;
  billingWarnings: number;
  lastBillingMonth?: string;
  suspendedAt?: string;
  fees?: PartnerFeePolicy;
  feePolicyId?: string;
  feeOverride?: boolean;
  distribution?: Partial<import('./salesFeePolicyStore.js').DistributionRates>;
  distributionApplyStart?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PartnerUserMapping {
  partnerId: string;
  partnerUserId: string;
  ourUserId: string;
  email?: string;
  createdAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARTNERS_FILE = join(__dirname, 'partners.json');
const MAPPINGS_FILE = join(__dirname, 'partner_user_mappings.json');

function loadPartners(): Partner[] {
  if (!existsSync(PARTNERS_FILE)) return [];
  try {
    const data = readFileSync(PARTNERS_FILE, 'utf-8');
    return JSON.parse(data).partners ?? [];
  } catch {
    return [];
  }
}

function loadMappings(): PartnerUserMapping[] {
  if (!existsSync(MAPPINGS_FILE)) return [];
  try {
    const data = readFileSync(MAPPINGS_FILE, 'utf-8');
    return JSON.parse(data).mappings ?? [];
  } catch {
    return [];
  }
}

function savePartners(partners: Partner[]): void {
  try {
    writeFileSync(PARTNERS_FILE, JSON.stringify({ partners }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save partners:', e);
  }
}

function saveMappings(mappings: PartnerUserMapping[]): void {
  try {
    writeFileSync(MAPPINGS_FILE, JSON.stringify({ mappings }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save partner mappings:', e);
  }
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

const partners = new Map<string, Partner>();
const apiKeyToPartner = new Map<string, string>();
const mappings = new Map<string, PartnerUserMapping>();
const partnerBillingBalances = new Map<string, number>();

function mappingKey(partnerId: string, partnerUserId: string): string {
  return `${partnerId}:${partnerUserId}`;
}

function loadAll(): void {
  partners.clear();
  apiKeyToPartner.clear();
  mappings.clear();
  for (const p of loadPartners()) {
    partners.set(p.id, p);
    apiKeyToPartner.set(p.apiKeyPrefix, p.id);
  }
  for (const m of loadMappings()) {
    mappings.set(mappingKey(m.partnerId, m.partnerUserId), m);
  }
}

loadAll();

export const partnerStore = {
  list(): Partner[] {
    return Array.from(partners.values());
  },

  getById(id: string): Partner | undefined {
    return partners.get(id);
  },

  getByApiKey(apiKey: string): Partner | undefined {
    const prefix = apiKey.slice(0, 12);
    const p = partners.get(apiKeyToPartner.get(prefix) || '');
    if (!p || p.status !== 'active') return undefined;
    const hash = hashApiKey(apiKey);
    return hash === p.apiKeyHash ? p : undefined;
  },

  create(data: {
    name: string;
    companyName?: string;
    businessNo?: string;
    ceoName?: string;
    phone?: string;
    orgParentId?: string;
    cardIssuePolicy?: CardIssuePolicy;
    allowVirtual?: boolean;
    allowPlastic?: boolean;
    fees?: PartnerFeePolicy;
    feePolicyId?: string;
    distribution?: Partner['distribution'];
  }): { partner: Partner; apiKey: string } {
    const id = 'ptr_' + randomBytes(8).toString('hex');
    const apiKey = 'pk_' + randomBytes(24).toString('hex');
    const prefix = apiKey.slice(0, 12);
    const cardIssuePolicy = data.cardIssuePolicy
      ?? issuePolicyFromPartner({ allowVirtual: data.allowVirtual, allowPlastic: data.allowPlastic });
    const flags = flagsFromIssuePolicy(cardIssuePolicy);
    const partner: Partner = {
      id,
      name: data.name,
      companyName: data.companyName,
      businessNo: data.businessNo,
      ceoName: data.ceoName,
      phone: data.phone,
      orgParentId: data.orgParentId,
      cardIssuePolicy,
      allowVirtual: flags.allowVirtual,
      allowPlastic: flags.allowPlastic,
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: prefix,
      status: 'active',
      billingWarnings: 0,
      fees: data.fees,
      feePolicyId: data.feePolicyId,
      feeOverride: Boolean(data.fees && Object.keys(data.fees).length),
      distribution: data.distribution,
      createdAt: new Date().toISOString(),
    };
    partners.set(id, partner);
    apiKeyToPartner.set(prefix, id);
    savePartners(Array.from(partners.values()));
    return { partner, apiKey };
  },

  update(id: string, data: Partial<Pick<Partner, 'name' | 'companyName' | 'status' | 'billingWalletAddress' | 'billingWarnings' | 'lastBillingMonth' | 'suspendedAt' | 'fees' | 'feePolicyId' | 'feeOverride' | 'businessNo' | 'ceoName' | 'phone' | 'orgUnitId' | 'orgParentId' | 'cardIssuePolicy' | 'allowVirtual' | 'allowPlastic' | 'distribution' | 'distributionApplyStart'>>): Partner | undefined {
    const p = partners.get(id);
    if (!p) return undefined;
    if (data.name != null) p.name = data.name;
    if (data.companyName != null) p.companyName = data.companyName;
    if (data.status != null) p.status = data.status;
    if (data.billingWalletAddress != null) p.billingWalletAddress = data.billingWalletAddress;
    if (data.billingWarnings != null) p.billingWarnings = data.billingWarnings;
    if (data.lastBillingMonth != null) p.lastBillingMonth = data.lastBillingMonth;
    if (data.suspendedAt != null) p.suspendedAt = data.suspendedAt;
    if (data.fees !== undefined) p.fees = data.fees;
    if (data.feePolicyId !== undefined) p.feePolicyId = data.feePolicyId;
    if (data.feeOverride !== undefined) p.feeOverride = data.feeOverride;
    if (data.businessNo != null) p.businessNo = data.businessNo;
    if (data.ceoName != null) p.ceoName = data.ceoName;
    if (data.phone != null) p.phone = data.phone;
    if (data.orgUnitId != null) p.orgUnitId = data.orgUnitId;
    if (data.orgParentId != null) p.orgParentId = data.orgParentId;
    if (data.cardIssuePolicy != null) {
      p.cardIssuePolicy = data.cardIssuePolicy;
      const flags = flagsFromIssuePolicy(data.cardIssuePolicy);
      p.allowVirtual = flags.allowVirtual;
      p.allowPlastic = flags.allowPlastic;
    } else {
      if (data.allowVirtual != null) p.allowVirtual = data.allowVirtual;
      if (data.allowPlastic != null) p.allowPlastic = data.allowPlastic;
      p.cardIssuePolicy = issuePolicyFromPartner(p);
    }
    if (data.distribution !== undefined) p.distribution = data.distribution;
    if (data.distributionApplyStart !== undefined) p.distributionApplyStart = data.distributionApplyStart;
    if (p.allowVirtual === undefined) p.allowVirtual = true;
    if (p.allowPlastic === undefined) p.allowPlastic = false;
    p.updatedAt = new Date().toISOString();
    savePartners(Array.from(partners.values()));
    return p;
  },

  regenerateApiKey(id: string): { partner: Partner; apiKey: string } | undefined {
    const p = partners.get(id);
    if (!p) return undefined;
    apiKeyToPartner.delete(p.apiKeyPrefix);
    const apiKey = 'pk_' + randomBytes(24).toString('hex');
    const prefix = apiKey.slice(0, 12);
    p.apiKeyHash = hashApiKey(apiKey);
    p.apiKeyPrefix = prefix;
    p.updatedAt = new Date().toISOString();
    partners.set(id, p);
    apiKeyToPartner.set(prefix, id);
    savePartners(Array.from(partners.values()));
    return { partner: p, apiKey };
  },

  getOurUserId(partnerId: string, partnerUserId: string): string | undefined {
    return mappings.get(mappingKey(partnerId, partnerUserId))?.ourUserId;
  },

  createMapping(partnerId: string, partnerUserId: string, ourUserId: string, email?: string): PartnerUserMapping {
    const m: PartnerUserMapping = {
      partnerId,
      partnerUserId,
      ourUserId,
      email,
      createdAt: new Date().toISOString(),
    };
    mappings.set(mappingKey(partnerId, partnerUserId), m);
    saveMappings(Array.from(mappings.values()));
    return m;
  },

  getBillingBalance(partnerId: string): number {
    return partnerBillingBalances.get(partnerId) ?? 0;
  },

  addBillingBalance(partnerId: string, amount: number): number {
    const current = partnerBillingBalances.get(partnerId) ?? 0;
    const next = current + amount;
    partnerBillingBalances.set(partnerId, next);
    return next;
  },

  deductBillingBalance(partnerId: string, amount: number): boolean {
    const current = partnerBillingBalances.get(partnerId) ?? 0;
    if (current < amount) return false;
    partnerBillingBalances.set(partnerId, current - amount);
    return true;
  },

  reload(): void {
    loadAll();
  },
};
