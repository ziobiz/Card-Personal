/**
 * Bridge: partner ledger → our Smart Wallet rail (mode 3)
 */

import { Router } from 'express';
import { requirePartnerAuth } from '../../middleware/partnerAuth.js';
import { store } from '../../data/store.js';
import { partnerStore } from '../../data/partnerStore.js';
import { bridgeStore } from '../../data/bridgeStore.js';
import { sandboxHelper } from '../../clients/wirex/SandboxHelperClient.js';
import { config } from '../../config.js';
import { isWalletModeAllowed, walletModeDeniedError } from '../../lib/walletPolicy.js';

const router = Router();
router.use(requirePartnerAuth);

function mapUser(req: { partner?: { id: string }; partnerUserId?: string }) {
  const pid = req.partnerUserId;
  if (!pid || !req.partner) return undefined;
  const ourId = partnerStore.getOurUserId(req.partner.id, pid);
  return ourId ? store.getUserById(ourId) : undefined;
}

router.get('/ledger', (req, res) => {
  res.json({
    tenantId: req.partner!.id,
    items: bridgeStore.list({ partnerId: req.partner!.id }),
  });
});

/** Partner deducted their closed-loop ledger and credits our rail */
router.post('/credit', async (req, res) => {
  try {
    const partnerUserId = req.partnerUserId || req.body?.partner_user_id;
    if (!partnerUserId) return res.status(400).json({ error: 'partner_user_id required' });
    if (!isWalletModeAllowed(req.partner, 'bridge')) {
      return res.status(403).json({ error: walletModeDeniedError('bridge') });
    }
    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || 'USD');
    if (!(amount > 0)) return res.status(400).json({ error: 'amount required' });
    const { v4: uuidv4 } = await import('uuid');
    let ourId = partnerStore.getOurUserId(req.partner!.id, partnerUserId);
    if (!ourId) {
      ourId = uuidv4();
      store.addPartnerUser({
        id: ourId,
        email: req.partnerUserEmail || `${partnerUserId}@partner.${req.partner!.id}`,
        passwordHash: '[partner]',
        source: 'partner',
        partnerId: req.partner!.id,
        walletMode: 'bridge',
        createdAt: new Date().toISOString(),
      });
      partnerStore.createMapping(req.partner!.id, partnerUserId, ourId, req.partnerUserEmail);
    }
    const user = store.getUserById(ourId);
    store.updateOnboarding(ourId, { walletMode: 'bridge' });
    if (user?.walletAddress && !config.useMockWirex) {
      try {
        await sandboxHelper.mintWusd(user.walletAddress, amount);
      } catch {
        /* record anyway */
      }
    }
    const entry = bridgeStore.add({
      partnerId: req.partner!.id,
      userId: ourId,
      direction: 'credit',
      amount,
      currency,
      status: 'posted',
      externalRef: String(req.body?.external_ref || ''),
    });
    res.status(201).json({ ok: true, entry });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/debit-request', async (req, res) => {
  const user = mapUser(req);
  if (!user) return res.status(400).json({ error: 'user not mapped' });
  const amount = Number(req.body?.amount || 0);
  if (!(amount > 0)) return res.status(400).json({ error: 'amount required' });
  const entry = bridgeStore.add({
    partnerId: req.partner!.id,
    userId: user.id,
    direction: 'debit_request',
    amount,
    currency: String(req.body?.currency || 'USD'),
    status: 'pending',
    externalRef: String(req.body?.external_ref || ''),
  });
  res.status(201).json({ ok: true, entry, partnerDebitUrl: req.partner!.bridgeDebitUrl || null });
});

export default router;
