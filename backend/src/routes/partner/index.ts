/**
 * 파트너 API - 타 업체 연동용
 * 1. 카드 발급 API  2. 지갑 연동 API
 */

import { Router } from 'express';
import partnerCards from './cards.js';
import partnerWallet from './wallet.js';

const router = Router();

router.use('/cards', partnerCards);
router.use('/wallet', partnerWallet);

router.get('/', (_, res) => {
  res.json({
    version: 'v1',
    endpoints: {
      cards: {
        description: '카드 발급·관리 API',
        base: '/api/partner/v1/cards',
        methods: ['GET /', 'POST /virtual', 'PUT /:cardId/block', 'PUT /:cardId/unblock', 'PUT /:cardId/freeze', 'PUT /:cardId/unfreeze', 'PUT /:cardId/limit'],
      },
      wallet: {
        description: '지갑 연동 API',
        base: '/api/partner/v1/wallet',
        methods: ['GET /balance', 'GET /tokens', 'GET /card/:cardId/deposit-info', 'POST /card/:cardId/deposit', 'POST /p2p', 'POST /refund', 'GET /transactions'],
      },
    },
    auth: 'X-API-Key or Authorization: Bearer <api_key>',
    user_id: 'X-Partner-User-Id (필수) - 파트너의 사용자 식별자',
  });
});

export default router;
