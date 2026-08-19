import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { travelRuleService } from '../services/travelRuleService.js';
import { config } from '../config.js';
import { store } from '../data/store.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';

const router = Router();
router.use(requireAuth);

router.post('/travel-rule/validate', async (req, res) => {
  try {
    const body = req.body ?? {};
    const result = await travelRuleService.validate({
      direction: body.direction === 'inbound' ? 'inbound' : 'outbound',
      amount: Number(body.amount ?? 0),
      currency: body.currency,
      asset: body.asset,
      originator: body.originator ?? {},
      beneficiary: body.beneficiary ?? {},
    });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/recipients', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const body = req.body ?? {};
    if (String(body.type).toLowerCase() === 'crypto' || body.crypto) {
      const check = await travelRuleService.validate({
        direction: 'outbound',
        amount: Number(body.amount ?? travelRuleService.thresholdUsd),
        originator: {
          name: user?.email,
          account: user?.walletAddress,
          country: user?.country ?? 'GB',
        },
        beneficiary: {
          name: body.first_name ? `${body.first_name} ${body.last_name ?? ''}`.trim() : body.nick_name,
          account: body.crypto?.address,
          country: body.beneficiary_country ?? body.country,
        },
      });
      if (!check.ok) return res.status(400).json({ error: 'Travel Rule validation failed', ...check });
    }
    if (config.useMockWirex) {
      return res.status(201).json({ id: 'rcpt_mock_' + Date.now(), ...body, mock: true });
    }
    const created = await wirexClient.createRecipient(
      { userId: user?.wirexUserId, email: user?.email, walletAddress: user?.walletAddress },
      body
    );
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/recipients', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (config.useMockWirex) return res.json({ items: [] });
    const list = await wirexClient.listRecipients({
      userId: user?.wirexUserId,
      email: user?.email,
      walletAddress: user?.walletAddress,
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
