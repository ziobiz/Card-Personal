/**
 * Solution packaging manifest
 * - white_label: sell full branded stack to another operator (separate deploy)
 * - saas_hq: ONTHELINE runs HQ; partners/merchants consume Partner API
 * - single_tenant: one operator, no partner resale
 *
 * Wirex credentials remain per-deployment until dedicated Sandbox/Production keys arrive.
 * Do NOT hardcode buyer brand into Wirex client — brandStore is the white-label surface.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { brandStore } from './brandStore.js';
import { config, getWirexBaaSConfig, getUseMockWirex } from '../config.js';

export type PackageMode = 'white_label' | 'saas_hq' | 'single_tenant';

export interface PackageManifest {
  /** Semver of the sellable product package */
  packageVersion: string;
  /** Commercial packaging mode */
  mode: PackageMode;
  /** Internal product code (stable across rebrands) */
  productCode: string;
  /** Public domains for this deployment */
  domains: {
    member: string;
    admin: string;
    partner: string;
    api: string;
  };
  /** Webhook base URL shared with Wirex during onboarding */
  webhookBaseUrl: string;
  /** Features included in this sold package */
  modules: {
    memberApp: boolean;
    adminConsole: boolean;
    partnerApi: boolean;
    partnerPortal: boolean;
    kyc: boolean;
    appleGooglePay: boolean;
    biometricAuth: boolean;
    feePolicy: boolean;
    orgHierarchy: boolean;
    whiteLabelBrand: boolean;
  };
  /** Commercial notes (not secrets) */
  notes?: string;
  updatedAt?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'package-manifest.json');

const DEFAULTS: PackageManifest = {
  packageVersion: '1.0.0',
  mode: 'saas_hq',
  productCode: 'ICOCARD-BAAS-PACK',
  domains: {
    member: 'https://icocard.net',
    admin: 'https://admin.icocard.net',
    partner: 'https://partner.icocard.net',
    api: 'https://api.icocard.net',
  },
  webhookBaseUrl: 'https://api.icocard.net',
  modules: {
    memberApp: true,
    adminConsole: true,
    partnerApi: true,
    partnerPortal: true,
    kyc: true,
    appleGooglePay: true,
    biometricAuth: true,
    feePolicy: true,
    orgHierarchy: true,
    whiteLabelBrand: true,
  },
  notes: 'Sellable card issuance package on Wirex BaaS. Brand via Admin → Brand. Wirex keys per deployment after Sandbox issuance.',
};

function load(): PackageManifest {
  if (!existsSync(FILE)) return { ...DEFAULTS, modules: { ...DEFAULTS.modules }, domains: { ...DEFAULTS.domains } };
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<PackageManifest>;
    return {
      ...DEFAULTS,
      ...parsed,
      domains: { ...DEFAULTS.domains, ...(parsed.domains || {}) },
      modules: { ...DEFAULTS.modules, ...(parsed.modules || {}) },
    };
  } catch {
    return { ...DEFAULTS, modules: { ...DEFAULTS.modules }, domains: { ...DEFAULTS.domains } };
  }
}

let cached = load();

function save() {
  writeFileSync(FILE, JSON.stringify(cached, null, 2), 'utf-8');
}

export const packageManifest = {
  get(): PackageManifest {
    return {
      ...cached,
      domains: { ...cached.domains },
      modules: { ...cached.modules },
    };
  },

  update(partial: Partial<PackageManifest>): PackageManifest {
    const next: PackageManifest = {
      ...cached,
      domains: { ...cached.domains },
      modules: { ...cached.modules },
    };
    if (partial.packageVersion) next.packageVersion = String(partial.packageVersion).slice(0, 32);
    if (partial.mode === 'white_label' || partial.mode === 'saas_hq' || partial.mode === 'single_tenant') {
      next.mode = partial.mode;
    }
    if (partial.productCode) next.productCode = String(partial.productCode).slice(0, 64);
    if (partial.webhookBaseUrl) next.webhookBaseUrl = String(partial.webhookBaseUrl).replace(/\/$/, '').slice(0, 200);
    if (partial.notes != null) next.notes = String(partial.notes).slice(0, 500);
    if (partial.domains) {
      for (const k of ['member', 'admin', 'partner', 'api'] as const) {
        if (typeof partial.domains[k] === 'string') {
          next.domains[k] = partial.domains[k].replace(/\/$/, '').slice(0, 200);
        }
      }
    }
    if (partial.modules) {
      for (const [k, v] of Object.entries(partial.modules)) {
        if (typeof v === 'boolean' && k in next.modules) {
          (next.modules as Record<string, boolean>)[k] = v;
        }
      }
    }
    next.updatedAt = new Date().toISOString();
    cached = next;
    save();
    return this.get();
  },

  /** Public packaging view for buyers / ops (no secrets) */
  publicView() {
    const pkg = this.get();
    const brand = brandStore.publicView();
    const w = getWirexBaaSConfig();
    return {
      packageVersion: pkg.packageVersion,
      productCode: pkg.productCode,
      mode: pkg.mode,
      brand: {
        productName: brand.productName,
        operatorName: brand.operatorName,
        cardBrandName: brand.cardBrandName,
      },
      domains: pkg.domains,
      webhookBaseUrl: pkg.webhookBaseUrl,
      modules: pkg.modules,
      wirex: {
        environment: w.environment,
        mock: getUseMockWirex(),
        configured: Boolean(w.clientId && w.clientSecret),
        // Sandbox keys: wait for Wirex issuance — do not force live until then
        awaitingDedicatedKeys: getUseMockWirex() || !process.env.WIREX_CLIENT_ID,
      },
      security: {
        otpMember: config.otpRequiredMember,
        otpAdmin: config.otpRequiredAdmin,
        webauthn: true,
      },
      notes: pkg.notes,
      updatedAt: pkg.updatedAt,
    };
  },
};
