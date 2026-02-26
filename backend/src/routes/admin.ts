/**
 * 관리자 API - 사용자/카드 목록, 통계, 환경설정
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAdmin } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { config } from '../config.js';
import { settingsStore } from '../data/settingsStore.js';
import { partnerStore } from '../data/partnerStore.js';
import { wirexService } from '../services/wirex/wirexService.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (email !== config.adminEmail || password !== config.adminPassword) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign(
    { userId: 'admin', email: config.adminEmail, isAdmin: true },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
  res.json({ token, user: { email: config.adminEmail, isAdmin: true } });
});

router.use(requireAdmin);

router.get('/users', (_, res) => {
  const users = Array.from(store.users.values()).map((u) => ({
    id: u.id,
    email: u.email,
    wirexUserId: u.wirexUserId,
    createdAt: u.createdAt,
  }));
  res.json({ items: users, total: users.length });
});

router.get('/cards', async (_, res) => {
  try {
    const allCards: Array<{ userId: string; email: string; card: Awaited<ReturnType<typeof wirexService.getCards>>['items'][0] }> = [];
    for (const user of store.users.values()) {
      if (!user.wirexUserId) continue;
      const { items } = await wirexService.getCards(user.wirexUserId, 1, 100);
      for (const card of items) {
        allCards.push({ userId: user.id, email: user.email, card });
      }
    }
    res.json({ items: allCards, total: allCards.length });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/stats', async (_, res) => {
  try {
    let totalCards = 0;
    let activeCards = 0;
    let totalBalance = 0;
    for (const user of store.users.values()) {
      if (!user.wirexUserId) continue;
      const { items } = await wirexService.getCards(user.wirexUserId, 1, 100);
      totalCards += items.length;
      activeCards += items.filter((c) => c.status === 'active').length;
      for (const c of items) {
        totalBalance += c.balance ?? 0;
      }
    }
    res.json({
      totalUsers: store.users.size,
      totalCards,
      activeCards,
      totalBalance,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/settings', (_, res) => {
  const s = settingsStore.get();
  res.json({
    wirex: s.wirex ?? {},
    feePolicy: s.feePolicy ?? {},
    useMockWirex: s.useMockWirex ?? true,
    updatedAt: s.updatedAt,
    _masked: {
      clientSecret: (s.wirex?.clientSecret?.length ?? 0) > 0 ? '********' : '',
    },
  });
});

router.put('/settings', (req, res) => {
  const body = req.body ?? {};
  const wirex = body.wirex ?? {};
  const useMockWirex = typeof body.useMockWirex === 'boolean' ? body.useMockWirex : undefined;
  const chainIdNum = wirex.chainId != null ? parseInt(String(wirex.chainId), 10) : NaN;
  const wirexUpdate: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string } = {
    apiBase: typeof wirex.apiBase === 'string' ? wirex.apiBase : undefined,
    chainId: !isNaN(chainIdNum) ? chainIdNum : undefined,
    clientId: typeof wirex.clientId === 'string' ? wirex.clientId : undefined,
  };
  if (typeof wirex.clientSecret === 'string' && wirex.clientSecret.length > 0) {
    wirexUpdate.clientSecret = wirex.clientSecret;
  }
  const feePolicy = body.feePolicy ?? {};
  const feePolicyUpdate = {
    treasuryWalletAddress: typeof feePolicy.treasuryWalletAddress === 'string' ? feePolicy.treasuryWalletAddress : undefined,
    cardIssuanceFee: typeof feePolicy.cardIssuanceFee === 'number' ? feePolicy.cardIssuanceFee : undefined,
    cardTopUpFeePercent: typeof feePolicy.cardTopUpFeePercent === 'number' ? feePolicy.cardTopUpFeePercent : undefined,
    cardUsageFeePerTransaction: typeof feePolicy.cardUsageFeePerTransaction === 'number' ? feePolicy.cardUsageFeePerTransaction : undefined,
    cardMonthlyFee: typeof feePolicy.cardMonthlyFee === 'number' ? feePolicy.cardMonthlyFee : undefined,
    partnerMonthlyFee: typeof feePolicy.partnerMonthlyFee === 'number' ? feePolicy.partnerMonthlyFee : undefined,
  };
  settingsStore.update({ wirex: wirexUpdate, useMockWirex, feePolicy: feePolicyUpdate });
  const s = settingsStore.get();
  res.json({
    wirex: s.wirex ?? {},
    feePolicy: s.feePolicy ?? {},
    useMockWirex: s.useMockWirex ?? true,
    updatedAt: s.updatedAt,
  });
});

router.get('/partners', (_, res) => {
  const items = partnerStore.list().map((p) => ({
    id: p.id,
    name: p.name,
    companyName: p.companyName,
    apiKeyPrefix: p.apiKeyPrefix + '...',
    status: p.status,
    billingWalletAddress: p.billingWalletAddress,
    billingWarnings: p.billingWarnings ?? 0,
    lastBillingMonth: p.lastBillingMonth,
    createdAt: p.createdAt,
  }));
  res.json({ items, total: items.length });
});

router.post('/partners', (req, res) => {
  const { name, companyName } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name required' });
  }
  const { partner, apiKey } = partnerStore.create({ name, companyName });
  res.status(201).json({
    partner: { id: partner.id, name: partner.name, companyName: partner.companyName, status: partner.status, createdAt: partner.createdAt },
    apiKey,
    warning: 'API Key is shown only once. Save it securely.',
  });
});

router.put('/partners/:id', (req, res) => {
  const { name, companyName, status, billingWalletAddress } = req.body ?? {};
  const updated = partnerStore.update(req.params.id, { name, companyName, status, billingWalletAddress: typeof billingWalletAddress === 'string' ? billingWalletAddress : undefined });
  if (!updated) return res.status(404).json({ error: 'Partner not found' });
  res.json({ id: updated.id, name: updated.name, companyName: updated.companyName, status: updated.status, updatedAt: updated.updatedAt });
});

router.put('/partners/:id/billing-wallet', (req, res) => {
  const { billingWalletAddress } = req.body ?? {};
  const updated = partnerStore.update(req.params.id, {
    billingWalletAddress: typeof billingWalletAddress === 'string' ? billingWalletAddress : undefined,
  });
  if (!updated) return res.status(404).json({ error: 'Partner not found' });
  res.json({ id: updated.id, billingWalletAddress: updated.billingWalletAddress });
});

router.post('/partners/:id/add-billing-balance', (req, res) => {
  const { amount } = req.body ?? {};
  const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'amount required' });
  const p = partnerStore.getById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Partner not found' });
  const newBalance = partnerStore.addBillingBalance(req.params.id, amt);
  res.json({ success: true, newBalance });
});

router.post('/partners/run-billing', async (req, res) => {
  try {
    const { feeSettings } = await import('../data/feeSettings.js');
    const { transactionStore } = await import('../data/transactionStore.js');
    const policy = feeSettings.get();
    const month = new Date().toISOString().slice(0, 7);
    const results: Array<{ partnerId: string; name: string; status: string; warning?: number }> = [];
    for (const p of partnerStore.list()) {
      if (p.status === 'suspended') continue;
      if (!p.billingWalletAddress) continue;
      if (p.lastBillingMonth === month) continue;
      const fee = policy.partnerMonthlyFee;
      const ok = partnerStore.deductBillingBalance(p.id, fee);
      if (ok) {
        partnerStore.update(p.id, { lastBillingMonth: month, billingWarnings: 0 });
        transactionStore.add({
          type: 'partner_billing',
          partnerId: p.id,
          amount: fee,
          fee: 0,
          currency: 'USD',
          status: 'completed',
          metadata: { month, treasury: policy.treasuryWalletAddress },
        });
        results.push({ partnerId: p.id, name: p.name, status: 'paid' });
      } else {
        const warnings = (p.billingWarnings ?? 0) + 1;
        partnerStore.update(p.id, {
          billingWarnings: warnings,
          ...(warnings >= 2 ? { status: 'suspended' as const, suspendedAt: new Date().toISOString() } : {}),
        });
        results.push({ partnerId: p.id, name: p.name, status: 'failed', warning: warnings });
      }
    }
    res.json({ month, results });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/partners/:id/regenerate-key', (req, res) => {
  const result = partnerStore.regenerateApiKey(req.params.id);
  if (!result) return res.status(404).json({ error: 'Partner not found' });
  res.json({
    partner: { id: result.partner.id, name: result.partner.name, status: result.partner.status },
    apiKey: result.apiKey,
    warning: 'Previous API Key is invalidated. New key shown only once.',
  });
});

export default router;
