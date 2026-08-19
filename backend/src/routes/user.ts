import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { mockWirex } from '../services/wirex/mockWirex.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.json({
        id: user?.id,
        email: user?.email,
        wirexUserId: null,
        walletAddress: user?.walletAddress,
      });
    }
    const wirexUser = await mockWirex.getUser(user.wirexUserId);
    res.json({
      id: user.id,
      email: user.email,
      wirexUserId: user.wirexUserId,
      walletAddress: user.walletAddress,
      country: user.country,
      status: wirexUser?.status ?? 'pending',
      mock: config.useMockWirex,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 온체인 등록된 EOA를 연결 — Live Sandbox 필수 */
router.put('/wallet', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const wallet_address = String(req.body?.wallet_address ?? '').trim();
    const country = String(req.body?.country ?? user.country ?? 'GB');
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({ error: 'Valid wallet_address (0x + 40 hex) required' });
    }
    if (!config.useMockWirex) {
      const registered = await wirexService.createUser({
        email: user.email,
        wallet_address,
        country,
      });
      store.updateWirexUserId(userId, registered.id || user.wirexUserId || '', {
        walletAddress: wallet_address,
        country,
      });
    } else {
      store.updateWirexUserId(userId, user.wirexUserId || user.id, { walletAddress: wallet_address, country });
    }
    const updated = store.getUserById(userId);
    res.json({
      id: updated?.id,
      email: updated?.email,
      wirexUserId: updated?.wirexUserId,
      walletAddress: updated?.walletAddress,
      country: updated?.country,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
