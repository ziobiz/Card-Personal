import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { partnerStore, canIssueCard } from '../data/partnerStore.js';

const router = Router();
router.use(requireAuth);

function partnerIssueCheck(userPartnerId: string | undefined, type: 'virtual' | 'plastic') {
  if (!userPartnerId) return { ok: true as const };
  return canIssueCard(partnerStore.getById(userPartnerId), type);
}

router.get('/', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.json({ items: [], total: 0 });
    }
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;
    const result = await wirexService.getCards(user.wirexUserId, page, size);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:cardId', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!user?.wirexUserId) return res.status(404).json({ error: 'Card not found' });
    const card = await wirexService.getCard(req.params.cardId, user.wirexUserId);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/virtual', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const issue = partnerIssueCheck(user.partnerId, 'virtual');
    if (!issue.ok) {
      return res.status(403).json({ error: issue.error });
    }
    const { billingService } = await import('../services/billingService.js');
    const feeResult = await billingService.applyCardIssueFee(userId, user.wirexUserId);
    if (!feeResult.ok) {
      return res.status(402).json({ error: 'Insufficient balance for card issuance fee', fee: feeResult.fee });
    }
    const card = await wirexService.createVirtualCard(user.wirexUserId, req.body);
    res.status(201).json({ ...card, issuanceFee: feeResult.fee });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/plastic', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const issue = partnerIssueCheck(user.partnerId, 'plastic');
    if (!issue.ok) {
      return res.status(403).json({ error: issue.error });
    }
    const { billingService } = await import('../services/billingService.js');
    const feeResult = await billingService.applyCardIssueFee(userId, user.wirexUserId);
    if (!feeResult.ok) {
      return res.status(402).json({ error: 'Insufficient balance for card issuance fee', fee: feeResult.fee });
    }
    const card = await wirexService.createPlasticCard(user.wirexUserId, req.body ?? {});
    res.status(201).json({ ...card, issuanceFee: feeResult.fee });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/activate', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const card = await wirexService.activateCard(req.params.cardId, req.body, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/block', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    const card = await wirexService.blockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/freeze', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    const card = await wirexService.blockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/unfreeze', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    const card = await wirexService.unblockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/unblock', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    const card = await wirexService.unblockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/limit', async (req, res) => {
  try {
    const { limit } = req.body;
    if (typeof limit !== 'number' && typeof limit !== 'string') {
      return res.status(400).json({ error: 'limit required' });
    }
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    const card = await wirexService.setCardLimit(req.params.cardId, { limit: Number(limit) }, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/close', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const card = await wirexService.closeCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.get('/3ds/requests', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const { threeDsStore } = await import('../data/threeDsStore.js');
    const { config } = await import('../config.js');
    const { wirexClient } = await import('../clients/wirex/WirexClient.js');
    if (!config.useMockWirex && user) {
      try {
        const live = await wirexClient.list3dsRequests({
          userId: user.wirexUserId,
          email: user.email,
          walletAddress: user.walletAddress,
        });
        return res.json(live);
      } catch {
        /* local */
      }
    }
    res.json({ items: threeDsStore.listPending(user?.id) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/3ds/:transactionId/approve', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const { threeDsStore } = await import('../data/threeDsStore.js');
    const { config } = await import('../config.js');
    const { wirexClient } = await import('../clients/wirex/WirexClient.js');
    if (!config.useMockWirex && user) {
      await wirexClient.approve3ds(
        { userId: user.wirexUserId, email: user.email, walletAddress: user.walletAddress },
        req.params.transactionId
      );
    }
    res.json({ ok: true, challenge: threeDsStore.setStatus(req.params.transactionId, 'approved') });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/3ds/:transactionId/decline', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const { threeDsStore } = await import('../data/threeDsStore.js');
    const { config } = await import('../config.js');
    const { wirexClient } = await import('../clients/wirex/WirexClient.js');
    if (!config.useMockWirex && user) {
      await wirexClient.decline3ds(
        { userId: user.wirexUserId, email: user.email, walletAddress: user.walletAddress },
        req.params.transactionId
      );
    }
    res.json({ ok: true, challenge: threeDsStore.setStatus(req.params.transactionId, 'declined') });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:cardId/wallet-tokens', async (req, res) => {
  const { walletTokenStore } = await import('../data/walletTokenStore.js');
  res.json({ items: walletTokenStore.list(req.auth!.userId, req.params.cardId) });
});

router.post('/:cardId/wallet-tokens', async (req, res) => {
  try {
    const wallet = req.body?.wallet === 'google_pay' ? 'google_pay' : 'apple_pay';
    const user = store.getUserById(req.auth!.userId);
    const { walletTokenStore } = await import('../data/walletTokenStore.js');
    const { config } = await import('../config.js');
    const { wirexClient } = await import('../clients/wirex/WirexClient.js');
    let remote: unknown = null;
    if (!config.useMockWirex && user) {
      try {
        remote = await wirexClient.provisionDigitalWallet(
          { userId: user.wirexUserId, email: user.email, walletAddress: user.walletAddress },
          req.params.cardId,
          { wallet, device_id: req.body?.device_id, certificates: req.body?.certificates }
        );
      } catch {
        remote = { note: 'Wirex digital-wallets endpoint unavailable; local DPAN issued for sandbox/dev' };
      }
    }
    const token = walletTokenStore.add({
      userId: req.auth!.userId,
      cardId: req.params.cardId,
      wallet,
      tokenReference: 'DPAN' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      deviceId: req.body?.device_id,
    });
    res.status(201).json({ ...token, remote });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
