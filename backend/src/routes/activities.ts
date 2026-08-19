import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { config } from '../config.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';
import { ledgerStore } from '../data/ledgerStore.js';

const router = Router();
router.use(requireAuth);

function ctxOf(userId: string) {
  const user = store.getUserById(userId);
  return { userId: user?.wirexUserId, email: user?.email, walletAddress: user?.walletAddress };
}

router.get('/', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    const types = typeof req.query.types === 'string' ? req.query.types.split(',') : undefined;
    const page = parseInt(String(req.query.page ?? '0'), 10);
    const size = Math.min(50, parseInt(String(req.query.size ?? '25'), 10));
    if (!config.useMockWirex && user) {
      try {
        const feed = await wirexClient.getActivityFeed(ctxOf(user.id), {
          page_number: page,
          page_size: size,
          types,
          subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        });
        return res.json(feed);
      } catch (e) {
        console.warn('[activities] live feed', (e as Error).message);
      }
    }
    const local = ledgerStore.list({ userId: user?.id }).slice(page * size, page * size + size);
    res.json({ data: local, total: ledgerStore.list({ userId: user?.id }).length, mock: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!config.useMockWirex && user) {
      try {
        const item = await wirexClient.getActivity(ctxOf(user.id), req.params.id);
        return res.json(item);
      } catch {
        /* local */
      }
    }
    const item = ledgerStore.list({ userId: user?.id }).find((x) => x.id === req.params.id || x.activityId === req.params.id);
    if (!item) return res.status(404).json({ error: 'Activity not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
