/**
 * White-label brand (ASP / 제3자 납품용)
 * Wirex 연동과 분리 — 브랜드·활성 언어만 교체해 배포 가능
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
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

/** UI chrome colors (admin shell + login panel) */
export interface BrandColorSet {
  /** 상단바 */
  headerBg: string;
  /** 사이드바 기본색 */
  sidebarBg: string;
  /** 메뉴 호버 */
  sidebarHover: string;
  /** 메뉴 선택·펼침 */
  sidebarActive: string;
  /** 사이드 서브메뉴 배경 */
  sidebarSub: string;
  /** 왼쪽 메뉴 글자색 */
  sidebarText: string;
  /** 로고 영역 배경 */
  logoBg: string;
  /** 상단바 아래 메뉴바(탭바) */
  tabbarBg: string;
  /** 탭바 글자색 */
  tabbarText: string;
  /** 탭바에서 클릭·선택된 탭 */
  tabbarActive: string;
  /** 접기 버튼 배경 */
  foldBg: string;
  /** 접기 버튼 호버 */
  foldHover: string;
  /** 왼쪽 메뉴 클릭 선택(하위 활성) */
  accentColor: string;
  /** 로그인 패널 배경 */
  loginPanelBg: string;
}

export interface BrandColorPreset {
  name: string;
  colors: BrandColorSet;
}

export interface BrandConfig extends BrandColorSet {
  productName: string;
  operatorName: string;
  cardBrandName: string;
  copyright: string;
  supportEmail: string;
  logoAdmin: string;
  logoLogin: string;
  /** Member shell (after login) top-left logo. Empty → falls back to logoLogin */
  logoMemberShell: string;
  /** Admin shell (after login) sidebar logo. Empty → falls back to logoAdmin */
  logoAdminShell: string;
  favicon: string;
  /** Browser tab + bookmark name. Empty → productName */
  browserTitle: string;
  /** Admin login left-panel hero (data URL or /path). Empty → system default. */
  loginHeroImage: string;
  /** Member login page background (data URL or /path). Empty → /user-hero-bg.png */
  memberLoginHeroImage: string;
  /** Optional overlay text on admin login hero */
  loginMainText: string;
  /** Show impersonation notice on admin login panel */
  loginNoticeEnabled: boolean;
  /** Editable notice title (empty → i18n partner.scamTitle) */
  loginNoticeTitle: string;
  /** Editable notice body (empty → i18n partner.scamBody) */
  loginNoticeBody: string;
  /** Open Graph — member (payment) surface. Separate from admin; no org-domain inheritance. */
  ogMemberTitle: string;
  ogMemberDescription: string;
  /** Public HTTPS path (/og/member.jpg) preferred; data URL accepted then persisted to /og/ */
  ogMemberImage: string;
  /** Open Graph — admin surface */
  ogAdminTitle: string;
  ogAdminDescription: string;
  ogAdminImage: string;
  /** Member/partner UI languages activated for this ASP tenant */
  enabledLocales: LocaleCode[];
  /** Fallback when browser lang is not enabled */
  defaultLocale: LocaleCode;
  /**
   * Named color tones (3 slots).
   * Slot 0/1 prefilled Light/Dark; slot 2 empty until user saves.
   */
  colorPresets: BrandColorPreset[];
  updatedAt?: string;
}

export const COLOR_KEYS = [
  'headerBg',
  'sidebarBg',
  'sidebarHover',
  'sidebarActive',
  'sidebarSub',
  'sidebarText',
  'logoBg',
  'tabbarBg',
  'tabbarText',
  'tabbarActive',
  'foldBg',
  'foldHover',
  'accentColor',
  'loginPanelBg',
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

/** Factory default — PG charcoal (초기화 대상) */
export const DEFAULT_COLORS: BrandColorSet = {
  headerBg: '#ffffff',
  sidebarBg: '#2c3138',
  sidebarHover: '#353b45',
  sidebarActive: '#252a32',
  sidebarSub: '#242933',
  sidebarText: '#d1d5db',
  logoBg: '#1f232b',
  tabbarBg: '#4a4a4a',
  tabbarText: '#c8cdd4',
  tabbarActive: '#3a3a3a',
  foldBg: '#3a4149',
  foldHover: '#454d56',
  accentColor: '#6658dd',
  loginPanelBg: '#e2e5ea',
};

/** Preset slot 0 — light */
export const LIGHT_COLORS: BrandColorSet = {
  headerBg: '#ffffff',
  sidebarBg: '#f3f4f6',
  sidebarHover: '#e5e7eb',
  sidebarActive: '#d1d5db',
  sidebarSub: '#e8eaed',
  sidebarText: '#374151',
  logoBg: '#e5e7eb',
  tabbarBg: '#9ca3af',
  tabbarText: '#1f2937',
  tabbarActive: '#6b7280',
  foldBg: '#d1d5db',
  foldHover: '#c4c9d1',
  accentColor: '#4f46e5',
  loginPanelBg: '#f8f9fb',
};

/** Preset slot 1 — dark */
export const DARK_COLORS: BrandColorSet = {
  headerBg: '#1a1d24',
  sidebarBg: '#15181e',
  sidebarHover: '#22262f',
  sidebarActive: '#0f1115',
  sidebarSub: '#0c0e12',
  sidebarText: '#d1d5db',
  logoBg: '#0a0c10',
  tabbarBg: '#2a2f38',
  tabbarText: '#c8cdd4',
  tabbarActive: '#1a1d24',
  foldBg: '#2a3038',
  foldHover: '#353c46',
  accentColor: '#818cf8',
  loginPanelBg: '#2c3138',
};

export const PRESET_SLOT_COUNT = 3;

export function defaultColorPresets(): BrandColorPreset[] {
  return [
    { name: '밝은색', colors: { ...LIGHT_COLORS } },
    { name: '어두운색', colors: { ...DARK_COLORS } },
    { name: '', colors: { ...DEFAULT_COLORS } },
  ];
}

function pickColors(src: Partial<BrandColorSet> | undefined, fallback: BrandColorSet): BrandColorSet {
  const out = { ...fallback };
  if (!src) return out;
  for (const key of COLOR_KEYS) {
    const c = clipColor(src[key]);
    if (c) out[key] = c;
  }
  return out;
}

function normalizePresets(raw: unknown): BrandColorPreset[] {
  const seeded = defaultColorPresets();
  if (!Array.isArray(raw)) return seeded;
  const out: BrandColorPreset[] = [];
  for (let i = 0; i < PRESET_SLOT_COUNT; i++) {
    const item = raw[i] as Partial<BrandColorPreset> | undefined;
    if (!item || typeof item !== 'object') {
      out.push(seeded[i]);
      continue;
    }
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 40) : seeded[i].name;
    const colors = pickColors(item.colors, seeded[i].colors);
    out.push({ name, colors });
  }
  return out;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'brand.json');

export const DEFAULT_BRAND: BrandConfig = {
  productName: 'ICOCARD',
  operatorName: 'ONTHELINE',
  cardBrandName: 'ICOCARD',
  copyright: 'Copyright © 2026 ICOCARD Service by ONTHELINE',
  supportEmail: '',
  ...DEFAULT_COLORS,
  logoAdmin: '',
  logoLogin: '',
  logoMemberShell: '',
  logoAdminShell: '',
  favicon: '',
  browserTitle: '',
  loginHeroImage: '',
  memberLoginHeroImage: '',
  loginMainText: '',
  loginNoticeEnabled: true,
  loginNoticeTitle: '',
  loginNoticeBody: '',
  ogMemberTitle: '',
  ogMemberDescription: '',
  ogMemberImage: '',
  ogAdminTitle: '',
  ogAdminDescription: '',
  ogAdminImage: '',
  enabledLocales: ['ko', 'en', 'ja', 'zh', 'th'],
  defaultLocale: 'en',
  colorPresets: defaultColorPresets(),
};

const OG_DIR = join(__dirname, 'og-assets');

/** Persist data-URL OG image to a public /og/{slot}.ext path (crawler-safe HTTPS). */
function persistOgImage(slot: 'member' | 'admin', value: string): string {
  if (value === '') {
    clearOgFiles(slot);
    return '';
  }
  const s = value.trim();
  if (s.startsWith('/og/') && s.length <= 200 && !s.includes('..')) return s;
  if (/^https?:\/\//i.test(s) && s.length <= 2000) return s;
  if (s.startsWith('/') && s.length <= 500 && !s.includes('..') && !s.startsWith('/og/')) {
    // site-relative (e.g. /brand/logo.png) — keep as-is
    return s;
  }
  const m = s.match(/^data:image\/([\w+.-]+);base64,(.+)$/i);
  if (!m) return '';
  let ext = m[1].toLowerCase().replace('jpeg', 'jpg');
  if (ext === 'svg+xml') ext = 'svg';
  if (!['png', 'jpg', 'webp', 'gif', 'svg'].includes(ext)) ext = 'png';
  mkdirSync(OG_DIR, { recursive: true });
  clearOgFiles(slot);
  const filename = `${slot}.${ext}`;
  writeFileSync(join(OG_DIR, filename), Buffer.from(m[2], 'base64'));
  return `/og/${filename}`;
}

function clearOgFiles(slot: 'member' | 'admin') {
  if (!existsSync(OG_DIR)) return;
  try {
    for (const name of readdirSync(OG_DIR)) {
      if (name.startsWith(`${slot}.`)) {
        try {
          unlinkSync(join(OG_DIR, name));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export function getOgAssetsDir(): string {
  mkdirSync(OG_DIR, { recursive: true });
  return OG_DIR;
}

function clipOgImageInput(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (v === '') return '';
  const s = v.trim();
  if (s.startsWith('data:image/')) return clipDataUrl(s, 2_500_000);
  if (/^https?:\/\//i.test(s) && s.length <= 2000) return s;
  if (s.startsWith('/') && s.length <= 500 && !s.includes('..')) return s;
  return undefined;
}

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
  if (!existsSync(FILE)) {
    return {
      ...DEFAULT_BRAND,
      enabledLocales: [...DEFAULT_BRAND.enabledLocales],
      colorPresets: defaultColorPresets(),
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<BrandConfig> & {
      colorPresets?: unknown;
    };
    const enabledLocales = normalizeLocales(parsed.enabledLocales, DEFAULT_BRAND.enabledLocales);
    let defaultLocale = (parsed.defaultLocale as LocaleCode) || DEFAULT_BRAND.defaultLocale;
    if (!enabledLocales.includes(defaultLocale)) defaultLocale = enabledLocales[0];
    const colors = pickColors(parsed, DEFAULT_COLORS);

    // Migrate pre-PG tones once for legacy flat fields
    const headerLegacy = new Set(['#604010', '#c4a484', '#4a5160', '#3a4049']);
    const sidebarLegacy = new Set(['#4a5160', '#3a4049', '#3d434c', '#2b2f36', '#252a30', '#1c1f24']);
    const accentLegacy = new Set(['#6b5ce7', '#6aa3e8', '#604010', '#c4a484']);
    const logoLegacy = new Set(['#4a5160', '#3a4049', '#252a30', '#3d434c', '#2b2f36']);
    if (headerLegacy.has(colors.headerBg.toLowerCase())) colors.headerBg = DEFAULT_COLORS.headerBg;
    if (sidebarLegacy.has(colors.sidebarBg.toLowerCase())) {
      Object.assign(colors, {
        sidebarBg: DEFAULT_COLORS.sidebarBg,
        sidebarHover: DEFAULT_COLORS.sidebarHover,
        sidebarActive: DEFAULT_COLORS.sidebarActive,
        sidebarSub: DEFAULT_COLORS.sidebarSub,
      });
    }
    if (accentLegacy.has(colors.accentColor.toLowerCase())) colors.accentColor = DEFAULT_COLORS.accentColor;
    if (logoLegacy.has(colors.logoBg.toLowerCase())) colors.logoBg = DEFAULT_COLORS.logoBg;

    // Fill missing new fields from defaults when old brand.json lacks them
    if (!parsed.sidebarHover) colors.sidebarHover = DEFAULT_COLORS.sidebarHover;
    if (!parsed.sidebarActive) colors.sidebarActive = DEFAULT_COLORS.sidebarActive;
    if (!parsed.sidebarSub) colors.sidebarSub = DEFAULT_COLORS.sidebarSub;
    if (!parsed.sidebarText) colors.sidebarText = DEFAULT_COLORS.sidebarText;
    if (!parsed.tabbarBg) colors.tabbarBg = DEFAULT_COLORS.tabbarBg;
    if (!parsed.tabbarText) colors.tabbarText = DEFAULT_COLORS.tabbarText;
    if (!parsed.tabbarActive) colors.tabbarActive = DEFAULT_COLORS.tabbarActive;
    if (!parsed.foldBg) colors.foldBg = DEFAULT_COLORS.foldBg;
    if (!parsed.foldHover) colors.foldHover = DEFAULT_COLORS.foldHover;

    const hadPresets = Array.isArray(parsed.colorPresets) && parsed.colorPresets.length > 0;
    const colorPresets = hadPresets ? normalizePresets(parsed.colorPresets) : defaultColorPresets();

    return {
      ...DEFAULT_BRAND,
      ...parsed,
      ...colors,
      enabledLocales,
      defaultLocale,
      colorPresets,
    };
  } catch {
    return {
      ...DEFAULT_BRAND,
      enabledLocales: [...DEFAULT_BRAND.enabledLocales],
      colorPresets: defaultColorPresets(),
    };
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
  const s = v.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return undefined;
}

function clipDataUrl(v: unknown, maxChars = 700_000): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (v === '') return '';
  if (!v.startsWith('data:image/')) return undefined;
  if (v.length > maxChars) return undefined;
  return v;
}

/** data URL, absolute http(s), or site-relative path */
function clipHeroImage(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  if (v === '') return '';
  const s = v.trim();
  if (s.startsWith('data:image/')) return clipDataUrl(s, 2_500_000);
  if (/^https?:\/\//i.test(s) && s.length <= 2000) return s;
  if (s.startsWith('/') && s.length <= 500 && !s.includes('..')) return s;
  return undefined;
}

function snapshotColors(src: BrandConfig): BrandColorSet {
  const out = { ...DEFAULT_COLORS };
  for (const key of COLOR_KEYS) out[key] = src[key] || DEFAULT_COLORS[key];
  return out;
}

export const brandStore = {
  get(): BrandConfig {
    return {
      ...cached,
      enabledLocales: [...cached.enabledLocales],
      colorPresets: cached.colorPresets.map((p) => ({
        name: p.name,
        colors: { ...p.colors },
      })),
    };
  },

  publicView(): BrandConfig {
    return this.get();
  },

  getDefaultColors(): BrandColorSet {
    return { ...DEFAULT_COLORS };
  },

  /** Restore factory PG colors (presets kept) */
  resetColors(): BrandConfig {
    Object.assign(cached, DEFAULT_COLORS);
    cached.updatedAt = new Date().toISOString();
    save();
    return this.get();
  },

  /** Apply a preset slot (0–2) to current colors */
  applyPreset(slot: number): BrandConfig {
    const i = Math.floor(Number(slot));
    if (i < 0 || i >= PRESET_SLOT_COUNT) return this.get();
    const preset = cached.colorPresets[i] || defaultColorPresets()[i];
    Object.assign(cached, pickColors(preset.colors, DEFAULT_COLORS));
    cached.updatedAt = new Date().toISOString();
    save();
    return this.get();
  },

  /** Save current colors into a named preset slot */
  savePreset(slot: number, name?: string): BrandConfig {
    const i = Math.floor(Number(slot));
    if (i < 0 || i >= PRESET_SLOT_COUNT) return this.get();
    const presets = cached.colorPresets.map((p) => ({
      name: p.name,
      colors: { ...p.colors },
    }));
    while (presets.length < PRESET_SLOT_COUNT) {
      presets.push(defaultColorPresets()[presets.length]);
    }
    const nextName =
      typeof name === 'string' && name.trim()
        ? name.trim().slice(0, 40)
        : presets[i].name || `Tone ${i + 1}`;
    presets[i] = { name: nextName, colors: snapshotColors(cached) };
    cached.colorPresets = presets;
    cached.updatedAt = new Date().toISOString();
    save();
    return this.get();
  },

  update(partial: Partial<BrandConfig>): BrandConfig {
    const next: BrandConfig = {
      ...cached,
      enabledLocales: [...cached.enabledLocales],
      colorPresets: cached.colorPresets.map((p) => ({
        name: p.name,
        colors: { ...p.colors },
      })),
    };
    const name = clipText(partial.productName, 40);
    if (name != null) next.productName = name || DEFAULT_BRAND.productName;
    const tab = clipText(partial.browserTitle, 60);
    if (tab != null) next.browserTitle = tab;
    const op = clipText(partial.operatorName, 80);
    if (op != null) next.operatorName = op;
    const card = clipText(partial.cardBrandName, 24);
    if (card != null) next.cardBrandName = card || next.productName;
    const copy = clipText(partial.copyright, 160);
    if (copy != null) next.copyright = copy;
    const mail = clipText(partial.supportEmail, 80);
    if (mail != null) next.supportEmail = mail;
    for (const key of COLOR_KEYS) {
      const c = clipColor(partial[key]);
      if (c) next[key] = c;
    }
    for (const key of ['logoAdmin', 'logoLogin', 'logoMemberShell', 'logoAdminShell', 'favicon'] as const) {
      if (partial[key] === undefined) continue;
      const img = clipDataUrl(partial[key]);
      if (img !== undefined) next[key] = img;
    }
    if (partial.loginHeroImage !== undefined) {
      const hero = clipHeroImage(partial.loginHeroImage);
      if (hero !== undefined) next.loginHeroImage = hero;
    }
    if (partial.memberLoginHeroImage !== undefined) {
      const hero = clipHeroImage(partial.memberLoginHeroImage);
      if (hero !== undefined) next.memberLoginHeroImage = hero;
    }
    const mainText = clipText(partial.loginMainText, 240);
    if (mainText != null) next.loginMainText = mainText;
    if (typeof partial.loginNoticeEnabled === 'boolean') {
      next.loginNoticeEnabled = partial.loginNoticeEnabled;
    }
    const noticeTitle = clipText(partial.loginNoticeTitle, 120);
    if (noticeTitle != null) next.loginNoticeTitle = noticeTitle;
    const noticeBody = clipText(partial.loginNoticeBody, 2000);
    if (noticeBody != null) next.loginNoticeBody = noticeBody;
    const ogMemberTitle = clipText(partial.ogMemberTitle, 80);
    if (ogMemberTitle != null) next.ogMemberTitle = ogMemberTitle;
    const ogMemberDescription = clipText(partial.ogMemberDescription, 300);
    if (ogMemberDescription != null) next.ogMemberDescription = ogMemberDescription;
    if (partial.ogMemberImage !== undefined) {
      const img = clipOgImageInput(partial.ogMemberImage);
      if (img !== undefined) next.ogMemberImage = persistOgImage('member', img);
    }
    const ogAdminTitle = clipText(partial.ogAdminTitle, 80);
    if (ogAdminTitle != null) next.ogAdminTitle = ogAdminTitle;
    const ogAdminDescription = clipText(partial.ogAdminDescription, 300);
    if (ogAdminDescription != null) next.ogAdminDescription = ogAdminDescription;
    if (partial.ogAdminImage !== undefined) {
      const img = clipOgImageInput(partial.ogAdminImage);
      if (img !== undefined) next.ogAdminImage = persistOgImage('admin', img);
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
    if (partial.colorPresets !== undefined) {
      next.colorPresets = normalizePresets(partial.colorPresets);
    }
    next.updatedAt = new Date().toISOString();
    cached = next;
    save();
    return this.get();
  },
};
