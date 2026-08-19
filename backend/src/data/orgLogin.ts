import { operatorStore } from './operatorStore.js';
import type { OrgUnit } from './orgStore.js';

export function createOrgLogin(unit: OrgUnit, body: Record<string, unknown>) {
  const loginId = String(body.loginId || body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!loginId) throw new Error('loginId required');
  if (!password || password.length < 8) throw new Error('password required (min 8)');
  const isMerchant = unit.orgLevel === 'MERCHANT' && Boolean(unit.partnerId);
  return operatorStore.create({
    email: loginId,
    name: String(body.ceoName || unit.name || loginId),
    password,
    scope: isMerchant ? 'PARTNER' : 'HQ',
    role: 'ADMIN',
    partnerId: isMerchant ? unit.partnerId : undefined,
    orgUnitId: unit.id,
    mustChangePassword: true,
  });
}
