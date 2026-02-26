/**
 * 파트너(타 업체) 저장소 - API Key 관리
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, createHash } from 'crypto';

export interface Partner {
  id: string;
  name: string;
  companyName?: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  status: 'active' | 'suspended';
  billingWalletAddress?: string;
  billingWarnings: number;
  lastBillingMonth?: string;
  suspendedAt?: string;
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

  create(data: { name: string; companyName?: string }): { partner: Partner; apiKey: string } {
    const id = 'ptr_' + randomBytes(8).toString('hex');
    const apiKey = 'pk_' + randomBytes(24).toString('hex');
    const prefix = apiKey.slice(0, 12);
    const partner: Partner = {
      id,
      name: data.name,
      companyName: data.companyName,
      apiKeyHash: hashApiKey(apiKey),
      apiKeyPrefix: prefix,
      status: 'active',
      billingWarnings: 0,
      createdAt: new Date().toISOString(),
    };
    partners.set(id, partner);
    apiKeyToPartner.set(prefix, id);
    savePartners(Array.from(partners.values()));
    return { partner, apiKey };
  },

  update(id: string, data: Partial<Pick<Partner, 'name' | 'companyName' | 'status' | 'billingWalletAddress' | 'billingWarnings' | 'lastBillingMonth' | 'suspendedAt'>>): Partner | undefined {
    const p = partners.get(id);
    if (!p) return undefined;
    if (data.name != null) p.name = data.name;
    if (data.companyName != null) p.companyName = data.companyName;
    if (data.status != null) p.status = data.status;
    if (data.billingWalletAddress != null) p.billingWalletAddress = data.billingWalletAddress;
    if (data.billingWarnings != null) p.billingWarnings = data.billingWarnings;
    if (data.lastBillingMonth != null) p.lastBillingMonth = data.lastBillingMonth;
    if (data.suspendedAt != null) p.suspendedAt = data.suspendedAt;
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
