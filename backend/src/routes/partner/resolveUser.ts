/**
 * Map partner_user_id → our user, creating an embedded Wirex rail if needed.
 * Partners never receive Wirex keys; onboarding uses HQ credentials.
 */

import { v4 as uuidv4 } from 'uuid';
import { store } from '../../data/store.js';
import { partnerStore } from '../../data/partnerStore.js';

export async function resolvePartnerUser(
  partnerId: string,
  partnerUserId: string,
  email?: string,
  walletMode: 'embedded' | 'external_eoa' | 'bridge' = 'embedded'
): Promise<string> {
  let ourUserId = partnerStore.getOurUserId(partnerId, partnerUserId);
  if (ourUserId) {
    const user = store.getUserById(ourUserId);
    if (user) return ourUserId;
  }
  store.loadUsers();
  const syntheticEmail = email || `${partnerUserId}@partner.${partnerId}`;
  ourUserId = uuidv4();
  store.addPartnerUser({
    id: ourUserId,
    email: syntheticEmail,
    passwordHash: '[partner]',
    source: 'partner',
    partnerId,
    walletMode,
    onboardingStatus: 'none',
    createdAt: new Date().toISOString(),
  });
  partnerStore.createMapping(partnerId, partnerUserId, ourUserId, email);
  if (walletMode !== 'external_eoa') {
    try {
      const { onboardingService } = await import('../../services/onboardingService.js');
      await onboardingService.run(ourUserId, { issueCard: false, mint: walletMode !== 'bridge' });
    } catch (e) {
      console.warn('partner onboard:', (e as Error).message);
    }
  }
  return ourUserId;
}
