import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { wirexService } from '../services/wirex/wirexService.js';

const router = Router();
router.use(requireAuth);

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

router.post('/virtual', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
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

router.put('/:cardId/activate', async (req, res) => {
  try {
    const { mockWirex } = await import('../services/wirex/mockWirex.js');
    const card = await mockWirex.activateCard(req.params.cardId, req.body);
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
    const card = await wirexService.closeCard(req.params.cardId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

export default router;
