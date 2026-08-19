/**
 * 파트너 테넌트용 Co-Branded 플랫폼 API
 * 카드/지갑 외에 KYC, 활동, 정산, Travel Rule, 디지털 월렛
 */

import { Router } from 'express';
import { requirePartnerAuth } from '../../middleware/partnerAuth.js';
import { store } from '../../data/store.js';
import { partnerStore } from '../../data/partnerStore.js';
import { ledgerStore } from '../../data/ledgerStore.js';
import { travelRuleService } from '../../services/travelRuleService.js';
import { getWirexBaaSConfig } from '../../config.js';

const router = Router();
router.use(requirePartnerAuth);

function ourUser(req: { partner?: { id: string }; partnerUserId?: string }) {
  const pid = req.partnerUserId;
  if (!pid || !req.partner) return undefined;
  const ourId = partnerStore.getOurUserId(req.partner.id, pid);
  return ourId ? store.getUserById(ourId) : undefined;
}

router.get('/kyc/status', (req, res) => {
  const user = ourUser(req);
  if (!user) return res.status(400).json({ error: 'partner_user_id required / user not mapped' });
  res.json({
    tenantId: req.partner!.id,
    kycStatus: user.kycStatus ?? 'pending',
    kycLevel: user.kycLevel,
    capabilities: user.capabilities ?? [],
  });
});

router.get('/activities', (req, res) => {
  const user = ourUser(req);
  const items = ledgerStore.list({ userId: user?.id, partnerId: req.partner!.id });
  res.json({ tenantId: req.partner!.id, items, total: items.length });
});

router.get('/reconciliation', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json({
    tenantId: req.partner!.id,
    summary: ledgerStore.summary({ from, to, partnerId: req.partner!.id }),
    entries: ledgerStore.list({ from, to, partnerId: req.partner!.id }),
  });
});

router.post('/travel-rule/validate', async (req, res) => {
  const result = await travelRuleService.validate({
    direction: req.body?.direction === 'inbound' ? 'inbound' : 'outbound',
    amount: Number(req.body?.amount ?? 0),
    currency: req.body?.currency,
    originator: req.body?.originator ?? {},
    beneficiary: req.body?.beneficiary ?? {},
  });
  res.status(result.ok ? 200 : 400).json({ tenantId: req.partner!.id, ...result });
});

router.get('/environment', (req, res) => {
  const c = getWirexBaaSConfig();
  res.json({
    tenantId: req.partner!.id,
    environment: c.environment,
    chainId: c.chainId,
    apiBase: c.apiBase,
    helperAvailable: Boolean(c.helperBase),
  });
});

export default router;
