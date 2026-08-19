/**
 * White-label brand (TINPASS / PG HQ policy platform 과 동일 개념)
 * Wirex 연동 설정과 분리 — 배포 시 브랜드만 교체 가능
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface BrandConfig {
  productName: string;
  operatorName: string;
  cardBrandName: string;
  copyright: string;
  supportEmail: string;
  headerBg: string;
  sidebarBg: string;
  accentColor: string;
  logoBg: string;
  logoAdmin: string;
  logoLogin: string;
  favicon: string;
  updatedAt?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'brand.json');

export const DEFAULT_BRAND: BrandConfig = {
  productName: 'ICOCARD',
  operatorName: 'ONTHELINE',
  cardBrandName: 'ICOCARD',
  copyright: 'Copyright © 2026 ICOCARD Service by ONTHELINE',
  supportEmail: '',
  headerBg: '#e9eaee',
  sidebarBg: '#2c3138',
  accentColor: '#6658dd',
  logoBg: '#2c3138',
  logoAdmin: '',
  logoLogin: '',
  favicon: '',
};

function load(): BrandConfig {
  if (!existsSync(FILE)) return { ...DEFAULT_BRAND };
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<BrandConfig>;
    return { ...DEFAULT_BRAND, ...parsed };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

let cached = load();

function save() {
  writeFileSync(FILE, JSON.stringify(cached, null, 2), 'utf-8');
}

function clipText(v: unknown, max = 200): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.trim().slice(0, max);
}

function clipColor(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s;
  return undefined;
}

function clipDataUrl(v: unknown, maxChars = 700_000): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (v === '') return '';
  if (!v.startsWith('data:image/')) return undefined;
  if (v.length > maxChars) return undefined;
  return v;
}

export const brandStore = {
  get(): BrandConfig {
    return { ...cached };
  },

  publicView(): Omit<BrandConfig, never> {
    return this.get();
  },

  update(partial: Partial<BrandConfig>): BrandConfig {
    const next: BrandConfig = { ...cached };
    const name = clipText(partial.productName, 40);
    if (name != null) next.productName = name || DEFAULT_BRAND.productName;
    const op = clipText(partial.operatorName, 80);
    if (op != null) next.operatorName = op;
    const card = clipText(partial.cardBrandName, 24);
    if (card != null) next.cardBrandName = card || next.productName;
    const copy = clipText(partial.copyright, 160);
    if (copy != null) next.copyright = copy;
    const mail = clipText(partial.supportEmail, 80);
    if (mail != null) next.supportEmail = mail;
    for (const key of ['headerBg', 'sidebarBg', 'accentColor', 'logoBg'] as const) {
      const c = clipColor(partial[key]);
      if (c) next[key] = c;
    }
    for (const key of ['logoAdmin', 'logoLogin', 'favicon'] as const) {
      if (partial[key] === undefined) continue;
      const img = clipDataUrl(partial[key]);
      if (img !== undefined) next[key] = img;
    }
    next.updatedAt = new Date().toISOString();
    cached = next;
    save();
    return this.get();
  },
};
