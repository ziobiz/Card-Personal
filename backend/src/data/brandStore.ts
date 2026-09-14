/**
 * White-label brand (ASP / 제3자 납품용)
 * Wirex 연동과 분리 — 브랜드·활성 언어만 교체해 배포 가능
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/** Catalog of locales the product can ship (HQ activates a subset per tenant) */
export const LOCALE_CATALOG = [
  'ko',
  'en',
  'ja',
  'zh',
  'th',
  'id',
  'vi',
  'ms',
  'fil',
  'hi',
  'my',
  'km',
  'lo',
] as const;

export type LocaleCode = (typeof LOCALE_CATALOG)[number];

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
  /** Member/partner UI languages activated for this ASP tenant */
  enabledLocales: LocaleCode[];
  /** Fallback when browser lang is not enabled */
  defaultLocale: LocaleCode;
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
  enabledLocales: ['ko', 'en', 'ja', 'zh', 'th'],
  defaultLocale: 'en',
};

function normalizeLocales(raw: unknown, fallback: LocaleCode[]): LocaleCode[] {
  if (!Array.isArray(raw)) return [...fallback];
  const set = new Set<LocaleCode>();
  for (const item of raw) {
    if (typeof item === 'string' && (LOCALE_CATALOG as readonly string[]).includes(item)) {
      set.add(item as LocaleCode);
    }
  }
  const list = [...set];
  return list.length ? list : [...fallback];
}

function load(): BrandConfig {
  if (!existsSync(FILE)) return { ...DEFAULT_BRAND, enabledLocales: [...DEFAULT_BRAND.enabledLocales] };
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<BrandConfig>;
    const enabledLocales = normalizeLocales(parsed.enabledLocales, DEFAULT_BRAND.enabledLocales);
    let defaultLocale = (parsed.defaultLocale as LocaleCode) || DEFAULT_BRAND.defaultLocale;
    if (!enabledLocales.includes(defaultLocale)) defaultLocale = enabledLocales[0];
    return {
      ...DEFAULT_BRAND,
      ...parsed,
      enabledLocales,
      defaultLocale,
    };
  } catch {
    return { ...DEFAULT_BRAND, enabledLocales: [...DEFAULT_BRAND.enabledLocales] };
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
    return {
      ...cached,
      enabledLocales: [...cached.enabledLocales],
    };
  },

  publicView(): BrandConfig {
    return this.get();
  },

  update(partial: Partial<BrandConfig>): BrandConfig {
    const next: BrandConfig = {
      ...cached,
      enabledLocales: [...cached.enabledLocales],
    };
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
    if (partial.enabledLocales !== undefined) {
      next.enabledLocales = normalizeLocales(partial.enabledLocales, DEFAULT_BRAND.enabledLocales);
    }
    if (partial.defaultLocale !== undefined) {
      const d = String(partial.defaultLocale);
      if ((LOCALE_CATALOG as readonly string[]).includes(d)) {
        next.defaultLocale = d as LocaleCode;
      }
    }
    if (!next.enabledLocales.includes(next.defaultLocale)) {
      next.defaultLocale = next.enabledLocales[0];
    }
    next.updatedAt = new Date().toISOString();
    cached = next;
    save();
    return this.get();
  },
};
