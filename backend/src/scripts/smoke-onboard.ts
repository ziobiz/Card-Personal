/**
 * Live Sandbox smoke: embedded EOA → AA → POST /user → KYC → mint → virtual card
 *   cd backend && npx tsx src/scripts/smoke-onboard.ts
 */
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { config, getWirexBaaSConfig } from '../config.js';
import { store } from '../data/store.js';
import { onboardingService } from '../services/onboardingService.js';

async function main() {
  const w = getWirexBaaSConfig();
  console.log('[smoke-onboard]', { mock: config.useMockWirex, env: w.environment, api: w.apiBase, chainId: w.chainId });
  if (config.useMockWirex) {
    console.error('Set USE_MOCK_WIREX=false');
    process.exit(1);
  }
  store.loadUsers();
  const email = (process.env.TEST_EMAIL || 'sandbox.ops@icocard.net').trim().toLowerCase();
  let user = store.getUserByEmail(email);
  if (!user) {
    store.addUser({
      id: uuidv4(),
      email,
      passwordHash: '[smoke]',
      country: 'GB',
      source: 'direct',
      onboardingStatus: 'none',
      createdAt: new Date().toISOString(),
    });
    user = store.getUserByEmail(email);
  }
  if (!user) {
    console.error('Failed to create smoke user');
    process.exit(1);
  }
  const result = await onboardingService.run(user.id, { issueCard: true, mint: true });
  for (const s of result.steps) {
    console.log(`  ${s.ok ? 'OK' : 'FAIL'} ${s.step}`, s.detail ?? '');
  }
  console.log('[smoke-onboard] result', {
    ok: result.ok,
    status: result.onboarding.status,
    eoa: result.onboarding.eoa,
    smartWallet: result.onboarding.smartWallet,
    wirexUserId: result.onboarding.wirexUserId,
    kycUrl: result.kycUrl || null,
  });
  process.exit(result.ok ? 0 : 2);
}

main().catch((e) => {
  console.error('[smoke-onboard] fatal', e);
  process.exit(1);
});
