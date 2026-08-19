/**
 * 파트너 API - 멀티 테넌트 Co-Branded
 */

import { Router } from 'express';
import partnerCards from './cards.js';
import partnerWallet from './wallet.js';
import partnerPlatform from './platform.js';

const router = Router();

router.get('/', (_, res) => {
  res.json({
    version: 'v1',
    multiTenant: true,
    endpoints: {
      cards: '/api/partner/v1/cards',
      wallet: '/api/partner/v1/wallet',
      kyc: 'GET /kyc/status',
      activities: 'GET /activities',
      reconciliation: 'GET /reconciliation',
      travelRule: 'POST /travel-rule/validate',
      walletTokens: 'POST /cards/:cardId/wallet-tokens',
      environment: 'GET /environment',
      catalog: 'GET /catalog',
    },
    auth: 'X-API-Key or Authorization: Bearer <api_key>',
    user_id: 'X-Partner-User-Id',
  });
});

router.get('/catalog', (_, res) => {
  res.json({
    version: 'v1',
    multiTenant: true,
    capabilities: [
      'card_issuance_virtual_physical',
      'apple_pay_google_pay_tokens',
      'user_kyc_aml',
      'travel_rule',
      'webhooks',
      'settlement_iso_reporting',
      'sandbox_production',
    ],
  });
});

router.use('/cards', partnerCards);
router.use('/wallet', partnerWallet);
router.use('/', partnerPlatform);

export default router;
