/**
 * 월렛 API - 스테이블코인(USDT/USDC) 연동
 * Wirex Pay: 프라이머리 월렛 → 카드 월렛 충전
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { wirexService } from '../services/wirex/wirexService.js';

const router = Router();
router.use(requireAuth);

router.get('/balance', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
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

router.get('/card/:cardId/deposit-info', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const info = await wirexService.getCardWallet(req.params.cardId);
    if (!info) {
      return res.status(404).json({ error: 'Card not found' });
    }
    const cardsResult = await wirexService.getCards(user.wirexUserId, 1, 100);
    const owned = cardsResult.items.some((c) => c.id === req.params.cardId);
    if (!owned) {
      return res.status(403).json({ error: 'Not your card' });
    }
    res.json({
      cardWalletAddress: info.address,
      currentBalance: info.balance,
      currency: info.currency,
      network: 'Base Sepolia',
      supportedTokens: wirexService.getSupportedTokens(),
      note: '실제 환경에서는 프라이머리 월렛에서 이 주소로 USDT/USDC를 온체인 전송하세요.',
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/p2p', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const { toUserId, amount } = req.body;
    const toId = typeof toUserId === 'string' ? toUserId.trim() : '';
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    if (!toId || isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'toUserId and amount required' });
    }
    const fromUser = store.getUserById(userId);
    const toUser = store.getUserById(toId);
    if (!fromUser?.wirexUserId || !toUser?.wirexUserId) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { mockWirex } = await import('../services/wirex/mockWirex.js');
    const { config } = await import('../config.js');
    if (!config.useMockWirex) {
      return res.status(501).json({ error: 'P2P available in mock mode only' });
    }
    const ok = await mockWirex.transferP2P(fromUser.wirexUserId, toUser.wirexUserId, amt);
    if (!ok) return res.status(402).json({ error: 'Insufficient balance' });
    const { billingService } = await import('../services/billingService.js');
    billingService.recordP2P(userId, toId, amt, 0);
    res.json({ success: true, amount: amt });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/refund', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const { amount } = req.body;
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'amount required' });
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) return res.status(400).json({ error: 'User not found' });
    const { feeSettings } = await import('../data/feeSettings.js');
    const policy = feeSettings.get();
    const fee = policy.treasuryWalletAddress ? Math.max(1, amt * 0.01) : 0;
    const total = amt + fee;
    const { mockWirex } = await import('../services/wirex/mockWirex.js');
    const { config } = await import('../config.js');
    if (!config.useMockWirex) return res.status(501).json({ error: 'Refund available in mock mode only' });
    const ok = await mockWirex.deductFromPrimary(user.wirexUserId, total);
    if (!ok) return res.status(402).json({ error: 'Insufficient balance for refund (incl. fee)' });
    const { billingService } = await import('../services/billingService.js');
    billingService.recordRefund(userId, amt, fee);
    res.json({ success: true, amount: amt, fee });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/card/:cardId/usage', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) return res.json({ items: [], total: 0 });
    const cardsResult = await wirexService.getCards(user.wirexUserId, 1, 100);
    const owned = cardsResult.items.some((c) => c.id === req.params.cardId);
    if (!owned) return res.status(403).json({ error: 'Not your card' });
    const { transactionStore } = await import('../data/transactionStore.js');
    const list = transactionStore.getCardUsage(req.params.cardId);
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const items = list.slice((page - 1) * size, page * size);
    res.json({ items, total: list.length });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const { transactionStore } = await import('../data/transactionStore.js');
    const list = transactionStore.list({ userId });
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const items = list.slice((page - 1) * size, page * size);
    res.json({ items, total: list.length });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/card/:cardId/deposit', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const cardsResult = await wirexService.getCards(user.wirexUserId, 1, 100);
    const owned = cardsResult.items.some((c) => c.id === req.params.cardId);
    if (!owned) {
      return res.status(403).json({ error: 'Not your card' });
    }
    const { amount, token } = req.body;
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const { billingService } = await import('../services/billingService.js');
    const feeResult = await billingService.applyCardTopUpFee(userId, user.wirexUserId, amt);
    if (!feeResult.ok) {
      return res.status(402).json({ error: 'Insufficient balance for top-up fee', fee: feeResult.fee });
    }
    const result = await wirexService.depositToCard(req.params.cardId, amt, token || 'USDT');
    res.json({ ...result, fee: feeResult.fee });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
