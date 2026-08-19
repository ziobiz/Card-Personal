/**
 * 파트너 지갑 연동 API
 * 타 업체가 자체 사이트에서 API로 지갑·카드 충전
 */

import { Router } from 'express';
import { requirePartnerAuth } from '../../middleware/partnerAuth.js';
import { store } from '../../data/store.js';
import { partnerStore } from '../../data/partnerStore.js';
import { wirexService } from '../../services/wirex/wirexService.js';

const router = Router();
router.use(requirePartnerAuth);

router.get('/balance', async (req, res) => {
  try {
    const raw = req.partnerUserId || (Array.isArray(req.query.partner_user_id) ? req.query.partner_user_id[0] : req.query.partner_user_id);
    const partnerUserId = typeof raw === 'string' ? raw.trim() : '';
    if (!partnerUserId) {
      return res.status(400).json({ error: 'partner_user_id required', hint: 'X-Partner-User-Id header or query param' });
    }
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, partnerUserId);
    if (!ourUserId) {
      return res.json({ primary: [], cardSummaries: [] });
    }
    const user = store.getUserById(ourUserId);
    if (!user?.wirexUserId) {
      return res.json({ primary: [], cardSummaries: [] });
    }
    const primary = await wirexService.getPrimaryWalletBalance(user.wirexUserId);
    const cardsResult = await wirexService.getCards(user.wirexUserId, 1, 100);
    const cardSummaries = await Promise.all(
      cardsResult.items.map(async (c) => {
        const w = await wirexService.getCardWallet(c.id);
        return w ? { cardId: c.id, panLast4: c.panLast4, balance: w.balance, currency: w.currency } : null;
      })
    );
    res.json({ primary, cardSummaries: cardSummaries.filter(Boolean) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/tokens', (_, res) => {
  res.json({ tokens: wirexService.getSupportedTokens() });
});

router.post('/p2p', async (req, res) => {
  try {
    const raw = req.partnerUserId || req.body?.partner_user_id;
    const pid = typeof raw === 'string' ? raw.trim() : '';
    if (!pid) return res.status(400).json({ error: 'partner_user_id required' });
    const { toPartnerUserId, amount } = req.body ?? {};
    const toPid = typeof toPartnerUserId === 'string' ? toPartnerUserId.trim() : '';
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    if (!toPid || isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'toPartnerUserId and amount required' });
    const fromOurId = partnerStore.getOurUserId(req.partner!.id, pid);
    const toOurId = partnerStore.getOurUserId(req.partner!.id, toPid);
    if (!fromOurId || !toOurId) return res.status(404).json({ error: 'User not found' });
    const fromUser = store.getUserById(fromOurId);
    const toUser = store.getUserById(toOurId);
    if (!fromUser?.wirexUserId || !toUser?.wirexUserId) return res.status(404).json({ error: 'User not ready' });
    const { mockWirex } = await import('../../services/wirex/mockWirex.js');
    const { config } = await import('../../config.js');
    if (!config.useMockWirex) return res.status(501).json({ error: 'P2P available in mock mode only' });
    const ok = await mockWirex.transferP2P(fromUser.wirexUserId, toUser.wirexUserId, amt);
    if (!ok) return res.status(402).json({ error: 'Insufficient balance' });
    const { billingService } = await import('../../services/billingService.js');
    billingService.recordP2P(fromOurId, toOurId, amt, 0);
    res.json({ success: true, amount: amt });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/refund', async (req, res) => {
  try {
    const raw = req.partnerUserId || req.body?.partner_user_id;
    const pid = typeof raw === 'string' ? raw.trim() : '';
    if (!pid) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, pid);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    if (!user?.wirexUserId) return res.status(400).json({ error: 'User not ready' });
    const { amount } = req.body ?? {};
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'amount required' });
    const { feeSettings } = await import('../../data/feeSettings.js');
    const policy = feeSettings.getForPartner(req.partner!.id);
    const fee = policy.treasuryWalletAddress ? Math.max(1, amt * 0.01) : 0;
    const total = amt + fee;
    const { mockWirex } = await import('../../services/wirex/mockWirex.js');
    const { config } = await import('../../config.js');
    if (!config.useMockWirex) return res.status(501).json({ error: 'Refund available in mock mode only' });
    const ok = await mockWirex.deductFromPrimary(user.wirexUserId, total);
    if (!ok) return res.status(402).json({ error: 'Insufficient balance for refund (incl. fee)' });
    const { billingService } = await import('../../services/billingService.js');
    billingService.recordRefund(ourUserId, amt, fee, req.partner!.id);
    res.json({ success: true, amount: amt, fee });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const raw = req.partnerUserId || req.query.partner_user_id;
    const pid = typeof raw === 'string' ? raw.trim() : '';
    if (!pid) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, pid);
    if (!ourUserId) return res.json({ items: [], total: 0 });
    const { transactionStore } = await import('../../data/transactionStore.js');
    const list = transactionStore.list({ userId: ourUserId });
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const items = list.slice((page - 1) * size, page * size);
    res.json({ items, total: list.length });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/card/:cardId/deposit-info', async (req, res) => {
  try {
    const raw2 = req.partnerUserId || req.query.partner_user_id;
    const partnerUserId2 = typeof raw2 === 'string' ? raw2.trim() : (Array.isArray(raw2) ? raw2[0] : raw2);
    const pid2 = typeof partnerUserId2 === 'string' ? partnerUserId2 : '';
    if (!pid2) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, pid2);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    if (!user?.wirexUserId) return res.status(400).json({ error: 'User not ready' });
    const cardsResult = await wirexService.getCards(user.wirexUserId, 1, 100);
    const owned = cardsResult.items.some((c) => c.id === req.params.cardId);
    if (!owned) return res.status(403).json({ error: 'Not your card' });
    const info = await wirexService.getCardWallet(req.params.cardId);
    if (!info) return res.status(404).json({ error: 'Card not found' });
    res.json({
      cardWalletAddress: info.address,
      currentBalance: info.balance,
      currency: info.currency,
      network: 'Base Sepolia',
      supportedTokens: wirexService.getSupportedTokens(),
      note: '프라이머리 월렛에서 이 주소로 USDT/USDC를 온체인 전송하세요.',
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/card/:cardId/deposit', async (req, res) => {
  try {
    const raw3 = req.partnerUserId || req.body?.partner_user_id;
    const pid3 = typeof raw3 === 'string' ? raw3.trim() : '';
    if (!pid3) return res.status(400).json({ error: 'partner_user_id required' });
    const ourUserId = partnerStore.getOurUserId(req.partner!.id, pid3);
    if (!ourUserId) return res.status(404).json({ error: 'User not found' });
    const user = store.getUserById(ourUserId);
    if (!user?.wirexUserId) return res.status(400).json({ error: 'User not ready' });
    const cardsResult = await wirexService.getCards(user.wirexUserId, 1, 100);
    const owned = cardsResult.items.some((c) => c.id === req.params.cardId);
    if (!owned) return res.status(403).json({ error: 'Not your card' });
    const { amount, token } = req.body;
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const { billingService } = await import('../../services/billingService.js');
    const feeResult = await billingService.applyCardTopUpFee(ourUserId, user.wirexUserId, amt, req.partner!.id);
    if (!feeResult.ok) return res.status(402).json({ error: 'Insufficient balance for top-up fee', fee: feeResult.fee });
    const result = await wirexService.depositToCard(req.params.cardId, amt, token || 'USDT');
    res.json({ ...result, fee: feeResult.fee });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
