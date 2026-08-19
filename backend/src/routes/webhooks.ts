/**
 * Wirex BaaS 웹훅 수신
 * https://docs.wirexapp.com/docs/webhooks
 */

import { Router, type Request, type Response } from 'express';
import { webhookStore, verifyWebhookSignature } from '../data/webhookStore.js';
import { ingestWebhook } from '../services/webhookIngest.js';

const router = Router();

function handle(path: string) {
  return async (req: Request, res: Response) => {
    const sig = String(req.headers['x-wirex-signature'] ?? req.headers['x-signature'] ?? '');
    const raw = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    if (!verifyWebhookSignature(raw, sig || undefined)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    const ev = webhookStore.add(path, req.body);
    try {
      await ingestWebhook(path, req.body);
    } catch (e) {
      console.warn('[webhook] ingest', (e as Error).message);
    }
    res.json({ ok: true, id: ev.id });
  };
}

router.post('/cards', handle('/v2/webhooks/cards'));
router.post('/card-limits', handle('/v2/webhooks/card-limits'));
router.post('/activities', handle('/v2/webhooks/activities'));
router.post('/user', handle('/v2/webhooks/user'));
router.post('/users', handle('/v2/webhooks/user'));
router.post('/3ds', handle('/v2/webhooks/3ds'));
router.post('/wallets', handle('/v2/webhooks/wallets'));
router.post('/balances', handle('/v2/webhooks/balances'));
router.post('/recipients', handle('/v2/webhooks/recipients'));
router.post('/erc-withdrawals', handle('/v2/webhooks/erc-withdrawals'));
router.post('/debt-cases', handle('/v2/webhooks/debt-cases'));
router.post('/corporations', handle('/v2/webhooks/corporations'));

export default router;
