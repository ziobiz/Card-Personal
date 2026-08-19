/**
 * Sandbox 테스트 API (RAMC Helper)
 * Mock 모드가 꺼져 있고 Helper API가 살아 있을 때 사용
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { sandboxHelper } from '../clients/wirex/SandboxHelperClient.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';

const router = Router();
router.use(requireAuth);

router.post('/mint', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const to = (req.body?.to as string) || user?.walletAddress;
    if (!to) return res.status(400).json({ error: 'wallet address (to) required' });
    const amount = Number(req.body?.amount ?? 100);
    const result = await sandboxHelper.mintWusd(to, amount);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/card-purchase', async (req, res) => {
  try {
    const { cardId, amount, currency } = req.body ?? {};
    if (!cardId) return res.status(400).json({ error: 'cardId required' });
    const result = await sandboxHelper.cardAuthAndClearing({
      cardId,
      amount: Number(amount ?? 10),
      currency: currency || 'USD',
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/sepa-deposit', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const email = (req.body?.email as string) || user?.email;
    if (!email) return res.status(400).json({ error: 'email required' });
    const result = await sandboxHelper.sepaDeposit(email, Number(req.body?.amount ?? 100));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/wirex-user', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!user?.wirexUserId && !user?.walletAddress) {
      return res.status(400).json({ error: 'Wirex user not linked' });
    }
    const profile = await wirexClient.getUser({
      userId: user.wirexUserId,
      email: user.email,
      walletAddress: user.walletAddress,
    });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
