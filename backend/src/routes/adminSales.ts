/**
 * 영업조직 · 기본/가맹점 수수료 정책 API (ziobiz/PG 동일 계층)
 */

import { Router } from 'express';
import { orgStore, ORG_LEVELS, parseOrgProfile, type OrgLevel } from '../data/orgStore.js';
import { salesFeePolicyStore } from '../data/salesFeePolicyStore.js';
import { feePolicyTemplateStore } from '../data/feePolicyTemplateStore.js';
import { partnerStore } from '../data/partnerStore.js';
import { transactionStore } from '../data/transactionStore.js';
import { operatorStore } from '../data/operatorStore.js';
import { createOrgLogin } from '../data/orgLogin.js';

const router = Router();

router.get('/org/levels', (_req, res) => {
  res.json({ items: orgStore.levels() });
});

router.get('/org', (req, res) => {
  const level = typeof req.query.level === 'string' ? (req.query.level as OrgLevel) : undefined;
  const items = orgStore.list(level && ORG_LEVELS.includes(level) ? level : undefined).map((u) => ({
    ...u,
    parentName: u.parentId ? orgStore.get(u.parentId)?.name : undefined,
  }));
  res.json({ items, total: items.length });
});

router.get('/login-id-available', (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  res.json({ available: !operatorStore.getByEmail(email) });
});

router.post('/org', (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { orgLevel, parentId, code, name } = body;
    if (!name || !orgLevel) return res.status(400).json({ error: 'name and orgLevel required' });
    const profile = parseOrgProfile(body);
    const unit = orgStore.create({
      orgLevel: orgLevel as OrgLevel,
      parentId: typeof parentId === 'string' ? parentId : undefined,
      code: typeof code === 'string' ? code : undefined,
      name: String(name),
      profile,
    });
    const operator = createOrgLogin(unit, body);
    orgStore.update(unit.id, { loginId: operator.email });
    res.status(201).json({ ...orgStore.get(unit.id), operator: operatorStore.publicView(operator) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.put('/org/:id', (req, res) => {
  try {
    const updated = orgStore.update(req.params.id, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.get('/sales-fee-policy', (_req, res) => {
  res.json(salesFeePolicyStore.get());
});

router.put('/sales-fee-policy', (req, res) => {
  const body = req.body ?? {};
  const updated = salesFeePolicyStore.update(body);
  const hq = feePolicyTemplateStore.getHq();
  feePolicyTemplateStore.update(hq.id, {
    fees: {
      cardIssuanceFee: updated.cardIssuanceFee,
      cardTopUpFeePercent: updated.cardTopUpFeePercent,
      cardUsageFeePerTransaction: updated.cardUsageFeePerTransaction,
      cardMonthlyFee: updated.cardMonthlyFee,
      partnerMonthlyFee: updated.partnerMonthlyFee,
      plasticIssuanceFee: updated.plasticIssuanceFee,
    },
    distribution: updated.distribution,
  });
  res.json(updated);
});

router.get('/fee-templates', (_req, res) => {
  res.json({ items: feePolicyTemplateStore.list() });
});

router.post('/fee-templates', (req, res) => {
  const body = req.body ?? {};
  if (!body.name) return res.status(400).json({ error: 'name required' });
  const item = feePolicyTemplateStore.create(body);
  res.status(201).json(item);
});

router.put('/fee-templates/:id', (req, res) => {
  const updated = feePolicyTemplateStore.update(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

router.delete('/fee-templates/:id', (req, res) => {
  const ok = feePolicyTemplateStore.remove(req.params.id);
  if (!ok) return res.status(400).json({ error: 'cannot delete headquarters default policy' });
  res.json({ ok: true });
});

router.get('/commissions', (req, res) => {
  const partnerId = typeof req.query.partnerId === 'string' ? req.query.partnerId : undefined;
  const items = transactionStore.list({ partnerId }).filter((t) => t.type === 'commission');
  res.json({ items, total: items.length });
});

router.get('/org/parents', (req, res) => {
  const level = (typeof req.query.forLevel === 'string' ? req.query.forLevel : 'MERCHANT') as OrgLevel;
  if (!ORG_LEVELS.includes(level)) return res.status(400).json({ error: 'invalid forLevel' });
  res.json({ items: orgStore.parentsFor(level) });
});

export default router;
