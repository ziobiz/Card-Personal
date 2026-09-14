/**
 * Wallet mode policy: HQ default or per-merchant custom (PG FOLLOW_HQ / CUSTOM).
 * Security control — only enabled modes may bind or credit the card rail.
 */

import { settingsStore } from '../data/settingsStore.js';

export type WalletModeKey = 'embedded' | 'external_eoa' | 'bridge';
export type WalletPolicySource = 'follow_hq' | 'custom';

export type WalletModes = {
  embedded: boolean;
  externalEoa: boolean;
  bridge: boolean;
};

export const DEFAULT_WALLET_MODES: WalletModes = {
  embedded: true,
  externalEoa: true,
  bridge: true,
};

export function normalizeWalletModes(raw?: Partial<WalletModes> | null): WalletModes {
  const next: WalletModes = {
    embedded: raw?.embedded !== false,
    externalEoa: raw?.externalEoa !== false,
    bridge: raw?.bridge !== false,
  };
  if (!next.embedded && !next.externalEoa && !next.bridge) next.embedded = true;
  return next;
}

export function hqWalletModes(): WalletModes {
  return normalizeWalletModes(settingsStore.get().walletPolicy);
}

export function resolveWalletModes(partner?: {
  walletPolicySource?: WalletPolicySource | string;
  walletModes?: Partial<WalletModes>;
} | null): WalletModes {
  if (partner?.walletPolicySource === 'custom') {
    return normalizeWalletModes(partner.walletModes);
  }
  return hqWalletModes();
}

export function isWalletModeAllowed(
  partner: { walletPolicySource?: string; walletModes?: Partial<WalletModes> } | null | undefined,
  mode: WalletModeKey
): boolean {
  const m = resolveWalletModes(partner);
  if (mode === 'embedded') return m.embedded;
  if (mode === 'external_eoa') return m.externalEoa;
  return m.bridge;
}

export function walletModeDeniedError(mode: WalletModeKey): string {
  return `Wallet mode '${mode}' is not enabled for this merchant`;
}
