/**
 * 파트너 카드 발급 API
 * 타 업체가 자체 사이트에서 API로 카드 발급·관리
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requirePartnerAuth } from '../../middleware/partnerAuth.js';
import { store } from '../../data/store.js';
import { partnerStore } from '../../data/partnerStore.js';
import { wirexService } from '../../services/wirex/wirexService.js';

const router = Router();
router.use(requirePartnerAuth);

async function resolvePartnerUser(partnerId: string, partnerUserId: string, email?: string): Promise<string> {
  let ourUserId = partnerStore.getOurUserId(partnerId, partnerUserId);
  if (ourUserId) {
    const user = store.getUserById(ourUserId);
    if (user) return ourUserId;
  }
  store.loadUsers();
  const syntheticEmail = email || `${partnerUserId}@partner.${partnerId}`;
  if (!ourUserId) {
    const wirexUser = await wirexService.createUser({ email: syntheticEmail });
    ourUserId = uuidv4();
    store.addPartnerUser({
      id: ourUserId,
      email: syntheticEmail,
      passwordHash: '[partner]',
      wirexUserId: wirexUser.id,
      createdAt: new Date().toISOString(),
    });
    partnerStore.createMapping(partnerId, partnerUserId, ourUserId, email);
  }
  return ourUserId;
}

router.get('/', async (req, res) => {
  try {
    const partnerUserId = (req.partnerUserId as string) || (Array.isArray(req.query.partner_user_id) ? req.query.partner_user_id[0] : req.query.partner_user_id);
    const pid = typeof partnerUserId === 'string' ? partnerUserId.trim() : '';
    if (!pid) {
      return res.status(400).json({ error: 'partner_user_id required', hint: 'X-Partner-User-Id header or query param' });
    }
    const ourUserId = await resolvePartnerUser(req.partner!.id, pid, req.partnerUserEmail);
    const user = store.getUserById(ourUserId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'User not ready' });
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
    const partnerUserId = req.partnerUserId || req.body?.partner_user_id;
    if (!partnerUserId) {
      return res.status(400).json({ error: 'partner_user_id required', hint: 'X-Partner-User-Id header or body' });
    }
    const ourUserId = await resolvePartnerUser(req.partner!.id, partnerUserId, req.partnerUserEmail || req.body?.email);
    const user = store.getUserById(ourUserId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'User not ready' });
    }
    const { billingService } = await import('../../services/billingService.js');
    const feeResult = await billingService.applyCardIssueFee(ourUserId, user.wirexUserId, req.partner!.id);
    if (!feeResult.ok) {
      return res.status(402).json({ error: 'Insufficient balance for card issuance fee', fee: feeResult.fee });
    }
    const card = await wirexService.createVirtualCard(user.wirexUserId, req.body);
    res.status(201).json({ ...card, issuanceFee: feeResult.fee });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/block', async (req, res) => {
  try {
    const partnerUserId = req.partnerUserId || req.body?.partner_user_id;
    if (!partnerUserId) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, partnerUserId);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    const card = await wirexService.blockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/freeze', async (req, res) => {
  try {
    const partnerUserId = req.partnerUserId || req.body?.partner_user_id;
    if (!partnerUserId) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, partnerUserId);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    const card = await wirexService.blockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/unfreeze', async (req, res) => {
  try {
    const partnerUserId = req.partnerUserId || req.body?.partner_user_id;
    if (!partnerUserId) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, partnerUserId);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    const card = await wirexService.unblockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/unblock', async (req, res) => {
  try {
    const partnerUserId = req.partnerUserId || req.body?.partner_user_id;
    if (!partnerUserId) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, partnerUserId);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    const card = await wirexService.unblockCard(req.params.cardId, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/limit', async (req, res) => {
  try {
    const partnerUserId = req.partnerUserId || req.body?.partner_user_id;
    if (!partnerUserId) return res.status(400).json({ error: 'partner_user_id required' });
    const { limit } = req.body;
    if (typeof limit !== 'number' && typeof limit !== 'string') {
      return res.status(400).json({ error: 'limit required' });
    }
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, partnerUserId);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    const card = await wirexService.setCardLimit(req.params.cardId, { limit: Number(limit) }, user?.wirexUserId);
    res.json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
