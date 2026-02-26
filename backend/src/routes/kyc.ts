/**
 * KYC API - Wirex Hosted KYC 검증 링크
 * docs.wirexapp.com/docs/kyc-hosted
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { wirexService } from '../services/wirex/wirexService.js';

const router = Router();
router.use(requireAuth);

router.get('/verification-link', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const url = await wirexService.getVerificationLink(user.wirexUserId, user.email);
    if (!url) {
      return res.json({ url: null, message: 'KYC verification is not configured. Using mock mode.' });
    }
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
