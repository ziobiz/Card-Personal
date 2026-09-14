/**
 * Wirex tenancy isolation.
 * API + sub-solution: HQ Wirex keys only. Wirex sees ICOCARD, never the sub-merchant.
 * Standalone: tenant's own Wirex contract. ICOCARD keys are not used or revealed.
 */

import { getWirexBaaSConfig } from '../config.js';
import { decryptSecret } from './partnerCredentials.js';
import type { Partner } from '../data/partnerStore.js';

export function isStandalone(partner?: { deliveryMode?: string } | null): boolean {
  return partner?.deliveryMode === 'sub_solution_standalone';
}

export function canRedistributeKeys(partner?: { deliveryMode?: string } | null): boolean {
  return !isStandalone(partner);
}

export function usesHqWirexRail(partner?: { deliveryMode?: string } | null): boolean {
  return !isStandalone(partner);
}

export function isolationNote(partner?: { deliveryMode?: string } | null): 'wirex_sees_icocard' | 'tenant_wirex_contract' {
  return isStandalone(partner) ? 'tenant_wirex_contract' : 'wirex_sees_icocard';
}

export function wirexConfigForPartner(partner?: Partner | null) {
  const hq = getWirexBaaSConfig();
  if (!isStandalone(partner) || !partner) return hq;
  if (!partner.wirexClientIdEnc || !partner.wirexClientSecretEnc) {
    throw new Error('Standalone Wirex keys are not configured');
  }
  return {
    ...hq,
    clientId: decryptSecret(partner.wirexClientIdEnc),
    clientSecret: decryptSecret(partner.wirexClientSecretEnc),
    partnerId: partner.wirexPartnerId || '',
  };
}
