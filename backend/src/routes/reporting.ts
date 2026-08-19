import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { config } from '../config.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';
import { ledgerStore } from '../data/ledgerStore.js';

const router = Router();

router.get('/statement', requireAuth, async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const start = Number(req.query.start ?? Math.floor(Date.now() / 1000) - 30 * 86400);
    const end = Number(req.query.end ?? Math.floor(Date.now() / 1000));
    if (!config.useMockWirex && user) {
      try {
        const stmt = await wirexClient.getFullStatement(
          { userId: user.wirexUserId, email: user.email, walletAddress: user.walletAddress },
          start,
          end
        );
        return res.json(stmt);
      } catch (e) {
        console.warn('[statement] live', (e as Error).message);
      }
    }
    const from = new Date(start * 1000).toISOString();
    const to = new Date(end * 1000).toISOString();
    const entries = ledgerStore.list({ userId: user?.id, from, to });
    res.json({
      period: { start, end },
      entries,
      summary: ledgerStore.summary({ from, to }),
      mock: config.useMockWirex,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/reconciliation', requireAuth, (req, res) => {
  const user = store.getUserById(req.auth!.userId);
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const entries = ledgerStore.list({ userId: user?.id, from, to });
  res.json({
    entries,
    summary: ledgerStore.summary({ from, to }),
    note: 'ISO MTI: 0100 authorization, 0200 settlement, 0420 refund/reversal, 0110 decline',
  });
});

router.get('/admin/reconciliation', requireAdmin, (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const partnerId = typeof req.query.partnerId === 'string' ? req.query.partnerId : undefined;
  res.json({
    entries: ledgerStore.list({ from, to, partnerId }),
    summary: ledgerStore.summary({ from, to, partnerId }),
  });
});

export default router;
