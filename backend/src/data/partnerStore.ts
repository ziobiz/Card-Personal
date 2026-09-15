/**
 * 파트너(타 업체) 저장소 - API Key 관리
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, createHash } from 'crypto';
import {
  encryptSecret,
  hashSecret,
  newApiKey,
  newApiSecret,
  newHmacSecret,
  newMid,
  parseDeliveryMode,
  slugify,
} from '../lib/partnerCredentials.js';
import { resolveWalletModes, type WalletPolicySource } from '../lib/walletPolicy.js';
import { canRedistributeKeys, isolationNote, isStandalone } from '../lib/wirexScope.js';
import { getWirexEnvironment } from '../config.js';
import { packageManifest } from './packageManifest.js';

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

export type DeliveryMode = 'api' | 'sub_solution' | 'sub_solution_standalone';

export interface PartnerWalletModes {
  embedded: boolean;
  externalEoa: boolean;
  bridge: boolean;
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
  /** HQ-issued merchant id (PG MID). Modes 1–2 never receive Wirex keys. */
  mid?: string;
  deliveryMode?: DeliveryMode;
  /** Standalone add-on only. API / sub-solution never enable tenant sales org. */
  salesOrgEnabled?: boolean;
  walletPolicySource?: WalletPolicySource;
  walletModes?: PartnerWalletModes;
  /** Standalone only: tenant Wirex contract (encrypted). Never used for API/sub_solution. */
  wirexClientIdEnc?: string;
  wirexClientSecretEnc?: string;
  wirexPartnerId?: string;
  apiSecretHash?: string;
  hmacSecretHash?: string;
  hmacSecretEnc?: string;
  webhookUrl?: string;
  allowedIps?: string[];
  solutionSlug?: string;
  solutionName?: string;
  bridgeDebitUrl?: string;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
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

export type CredentialKit = {
  issuer: 'ICOCARD';
  warning: string;
  mid: string;
  environment: 'sandbox' | 'live';
  deliveryMode: DeliveryMode;
  solutionSlug?: string;
  solutionUrl?: string;
  apiKey: string;
  apiSecret: string;
  hmacSecret: string;
  auth: {
    apiKeyHeader: 'X-API-Key';
    secretHeader: 'X-API-Secret';
    hmac: { timestamp: 'X-ICO-Timestamp'; signature: 'X-ICO-Signature'; mid: 'X-ICO-Mid' };
    user: 'X-Partner-User-Id';
  };
  endpoints: Record<string, string>;
};

function publicApiBase(): string {
  const d = packageManifest.get().domains;
  return `${d.api.replace(/\/$/, '')}/api/partner/v1`;
}

function memberBase(): string {
  return packageManifest.get().domains.member.replace(/\/$/, '');
}

function buildKit(
  partner: Partner,
  secrets: { apiKey: string; apiSecret: string; hmacSecret: string; live: boolean }
): CredentialKit {
  const base = publicApiBase();
  const member = memberBase();
  return {
    issuer: 'ICOCARD',
    warning: 'Secrets are shown once. Partners use these ICOCARD keys only — never Wirex keys.',
    mid: partner.mid || '',
    environment: secrets.live ? 'live' : 'sandbox',
    deliveryMode: partner.deliveryMode || 'api',
    solutionSlug: partner.solutionSlug,
    solutionUrl: partner.solutionSlug ? `${member}/s/${partner.solutionSlug}` : undefined,
    apiKey: secrets.apiKey,
    apiSecret: secrets.apiSecret,
    hmacSecret: secrets.hmacSecret,
    auth: {
      apiKeyHeader: 'X-API-Key',
      secretHeader: 'X-API-Secret',
      hmac: { timestamp: 'X-ICO-Timestamp', signature: 'X-ICO-Signature', mid: 'X-ICO-Mid' },
      user: 'X-Partner-User-Id',
    },
    endpoints: {
      base,
      cards: `${base}/cards`,
      wallet: `${base}/wallet`,
      bridgeCredit: `${base}/bridge/credit`,
      bridgeDebit: `${base}/bridge/debit-request`,
      kyc: `${base}/kyc/status`,
      catalog: `${base}/catalog`,
    },
  };
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
    if (p.apiKeyPrefix) apiKeyToPartner.set(p.apiKeyPrefix, p.id);
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

  getBySlug(slug: string): Partner | undefined {
    return Array.from(partners.values()).find((p) => p.solutionSlug === slug && p.status === 'active');
  },

  getByMid(mid: string): Partner | undefined {
    return Array.from(partners.values()).find((p) => p.mid === mid && p.status === 'active');
  },

  publicCredentialView(p: Partner) {
    const standalone = isStandalone(p);
    return {
      mid: p.mid || '',
      deliveryMode: p.deliveryMode || 'api',
      salesOrgEnabled: isStandalone(p) && Boolean(p.salesOrgEnabled),
      walletPolicySource: p.walletPolicySource === 'custom' ? 'custom' : 'follow_hq',
      walletModes: resolveWalletModes(p),
      apiKeyPrefix: standalone ? '' : (p.apiKeyPrefix || '') + '...',
      hasApiSecret: standalone ? false : Boolean(p.apiSecretHash),
      hasHmac: standalone ? false : Boolean(p.hmacSecretHash),
      canRedistributeKeys: canRedistributeKeys(p),
      isolation: isolationNote(p),
      wirexRail: standalone ? 'tenant_contract' : 'icocard_hq',
      wirexConfigured: standalone ? Boolean(p.wirexClientIdEnc && p.wirexClientSecretEnc) : true,
      webhookUrl: p.webhookUrl || '',
      allowedIps: p.allowedIps || [],
      solutionSlug: p.solutionSlug || '',
      solutionName: p.solutionName || p.companyName || p.name,
      solutionUrl: p.solutionSlug ? `${memberBase()}/s/${p.solutionSlug}` : '',
      bridgeDebitUrl: p.bridgeDebitUrl || '',
      endpoints: standalone
        ? {}
        : buildKit(p, { apiKey: '', apiSecret: '', hmacSecret: '', live: getWirexEnvironment() === 'production' }).endpoints,
    };
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
    deliveryMode?: DeliveryMode;
    salesOrgEnabled?: boolean;
    walletPolicySource?: WalletPolicySource;
    walletModes?: PartnerWalletModes;
    webhookUrl?: string;
    solutionName?: string;
    bridgeDebitUrl?: string;
    wirexClientId?: string;
    wirexClientSecret?: string;
    wirexPartnerId?: string;
  }): { partner: Partner; apiKey: string; kit: CredentialKit | null } {
    const id = 'ptr_' + randomBytes(8).toString('hex');
    const live = getWirexEnvironment() === 'production';
    const deliveryMode = parseDeliveryMode(data.deliveryMode);
    const standalone = deliveryMode === 'sub_solution_standalone';
    const apiKey = standalone ? '' : newApiKey(live);
    const apiSecret = standalone ? '' : newApiSecret(live);
    const hmacSecret = standalone ? '' : newHmacSecret();
    const prefix = apiKey ? apiKey.slice(0, 12) : '';
    const cardIssuePolicy = data.cardIssuePolicy
      ?? issuePolicyFromPartner({ allowVirtual: data.allowVirtual, allowPlastic: data.allowPlastic });
    const flags = flagsFromIssuePolicy(cardIssuePolicy);
    const mid = newMid();
    const slugBase = slugify(data.companyName || data.name);
    let solutionSlug = slugBase;
    let n = 1;
    while ([...partners.values()].some((x) => x.solutionSlug === solutionSlug)) {
      solutionSlug = `${slugBase}${n++}`;
    }
    const needsSlug = deliveryMode === 'sub_solution' || deliveryMode === 'sub_solution_standalone';
    const walletPolicySource: WalletPolicySource = data.walletPolicySource === 'custom' ? 'custom' : 'follow_hq';
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
      mid,
      deliveryMode,
      salesOrgEnabled: standalone && Boolean(data.salesOrgEnabled),
      walletPolicySource,
      walletModes: walletPolicySource === 'custom' ? resolveWalletModes({ walletPolicySource: 'custom', walletModes: data.walletModes }) : undefined,
      apiSecretHash: standalone ? undefined : hashSecret(apiSecret),
      hmacSecretHash: standalone ? undefined : hashSecret(hmacSecret),
      hmacSecretEnc: standalone ? undefined : encryptSecret(hmacSecret),
      webhookUrl: data.webhookUrl,
      solutionSlug: needsSlug ? solutionSlug : undefined,
      wirexClientIdEnc: standalone && data.wirexClientId ? encryptSecret(data.wirexClientId) : undefined,
      wirexClientSecretEnc: standalone && data.wirexClientSecret ? encryptSecret(data.wirexClientSecret) : undefined,
      wirexPartnerId: standalone ? data.wirexPartnerId : undefined,
      solutionName: data.solutionName || data.companyName || data.name,
      bridgeDebitUrl: data.bridgeDebitUrl,
      apiKeyHash: standalone ? undefined : hashApiKey(apiKey),
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
    if (prefix) apiKeyToPartner.set(prefix, id);
    savePartners(Array.from(partners.values()));
    const kit = canRedistributeKeys(partner) ? buildKit(partner, { apiKey, apiSecret, hmacSecret, live }) : null;
    return { partner, apiKey: kit ? apiKey : '', kit };
  },

  update(id: string, data: Partial<Pick<Partner, 'name' | 'companyName' | 'status' | 'billingWalletAddress' | 'billingWarnings' | 'lastBillingMonth' | 'suspendedAt' | 'fees' | 'feePolicyId' | 'feeOverride' | 'businessNo' | 'ceoName' | 'phone' | 'orgUnitId' | 'orgParentId' | 'cardIssuePolicy' | 'allowVirtual' | 'allowPlastic' | 'distribution' | 'distributionApplyStart' | 'deliveryMode' | 'walletPolicySource' | 'walletModes' | 'webhookUrl' | 'allowedIps' | 'solutionSlug' | 'solutionName' | 'bridgeDebitUrl' | 'wirexPartnerId'>>): Partner | undefined {
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
    if (data.deliveryMode === 'api' || data.deliveryMode === 'sub_solution' || data.deliveryMode === 'sub_solution_standalone') {
      p.deliveryMode = data.deliveryMode;
    }
    if (data.walletPolicySource === 'follow_hq' || data.walletPolicySource === 'custom') {
      p.walletPolicySource = data.walletPolicySource;
    }
    if (data.walletModes) p.walletModes = resolveWalletModes({ walletPolicySource: 'custom', walletModes: data.walletModes });
    if (data.webhookUrl !== undefined) p.webhookUrl = data.webhookUrl;
    if (data.allowedIps !== undefined) p.allowedIps = data.allowedIps;
    if (data.solutionName !== undefined) p.solutionName = data.solutionName;
    if (data.bridgeDebitUrl !== undefined) p.bridgeDebitUrl = data.bridgeDebitUrl;
    if (data.wirexPartnerId !== undefined) p.wirexPartnerId = data.wirexPartnerId;
    if (data.solutionSlug !== undefined) {
      const slug = slugify(data.solutionSlug || p.companyName || p.name);
      const clash = Array.from(partners.values()).find((x) => x.id !== p.id && x.solutionSlug === slug);
      p.solutionSlug = clash ? `${slug}${randomBytes(2).toString('hex')}` : slug;
    }
    if ((p.deliveryMode === 'sub_solution' || p.deliveryMode === 'sub_solution_standalone') && !p.solutionSlug) {
      p.solutionSlug = slugify(p.companyName || p.name) + randomBytes(2).toString('hex');
    }
    if (isStandalone(p)) {
      if (p.apiKeyPrefix) apiKeyToPartner.delete(p.apiKeyPrefix);
      p.apiKeyPrefix = '';
      p.apiKeyHash = undefined;
      p.apiSecretHash = undefined;
      p.hmacSecretHash = undefined;
      p.hmacSecretEnc = undefined;
    }
    if (!p.mid) p.mid = newMid();
    if (p.allowVirtual === undefined) p.allowVirtual = true;
    if (p.allowPlastic === undefined) p.allowPlastic = false;
    p.updatedAt = new Date().toISOString();
    savePartners(Array.from(partners.values()));
    return p;
  },

  setStandaloneWirexKeys(id: string, clientId: string, clientSecret: string): Partner | undefined {
    const p = partners.get(id);
    if (!p || !isStandalone(p)) return undefined;
    if (clientId) p.wirexClientIdEnc = encryptSecret(clientId);
    if (clientSecret) p.wirexClientSecretEnc = encryptSecret(clientSecret);
    p.updatedAt = new Date().toISOString();
    savePartners(Array.from(partners.values()));
    return p;
  },

  regenerateApiKey(id: string): { partner: Partner; apiKey: string; kit: CredentialKit } | undefined {
    const p = partners.get(id);
    if (!p || isStandalone(p)) return undefined;
    if (p.apiKeyPrefix) apiKeyToPartner.delete(p.apiKeyPrefix);
    const live = getWirexEnvironment() === 'production';
    const apiKey = newApiKey(live);
    const apiSecret = newApiSecret(live);
    const hmacSecret = newHmacSecret();
    const prefix = apiKey.slice(0, 12);
    if (!p.mid) p.mid = newMid();
    p.apiKeyHash = hashApiKey(apiKey);
    p.apiKeyPrefix = prefix;
    p.apiSecretHash = hashSecret(apiSecret);
    p.hmacSecretHash = hashSecret(hmacSecret);
    p.hmacSecretEnc = encryptSecret(hmacSecret);
    p.updatedAt = new Date().toISOString();
    partners.set(id, p);
    apiKeyToPartner.set(prefix, id);
    savePartners(Array.from(partners.values()));
    return { partner: p, apiKey, kit: buildKit(p, { apiKey, apiSecret, hmacSecret, live }) };
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
