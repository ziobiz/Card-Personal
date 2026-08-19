/**
 * 관리자 API - 사용자/카드 목록, 통계, 환경설정
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAdmin } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { config } from '../config.js';
import { settingsStore } from '../data/settingsStore.js';
import { partnerStore, type PartnerFeePolicy, type Partner, parseCardIssuePolicy, issuePolicyFromPartner, flagsFromIssuePolicy } from '../data/partnerStore.js';
import { feeSettings } from '../data/feeSettings.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { webhookStore } from '../data/webhookStore.js';
import { orgStore, parseOrgProfile } from '../data/orgStore.js';
import { createOrgLogin } from '../data/orgLogin.js';
import { brandStore } from '../data/brandStore.js';
import { resolvePartnerPolicy } from '../data/feePolicyTemplateStore.js';
import { operatorStore } from '../data/operatorStore.js';
import adminSales from './adminSales.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const emailNorm = String(email).trim().toLowerCase();
  const allowedEmails = new Set([
    config.adminEmail.toLowerCase(),
    'admin@icocard.local',
    'admin@wirexcard.local',
  ]);
  const op = operatorStore.getByEmail(emailNorm);
  const passwordHash = operatorStore.hashPassword(String(password));
  const hqOk =
    (allowedEmails.has(emailNorm) && password === config.adminPassword) ||
    (op && op.scope === 'HQ' && op.status === 'active' && op.passwordHash === passwordHash);
  if (!hqOk) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign(
    { userId: op?.id || 'admin', email: emailNorm, isAdmin: true },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
  res.json({
    token,
    user: { email: emailNorm, isAdmin: true, name: op?.name },
    mustChangePassword: Boolean(op?.mustChangePassword),
    otpRequired: false,
  });
});

router.use(requireAdmin);
router.use(adminSales);

type PostcodeItem = { zip: string; address: string };

function uniqPostcodes(items: PostcodeItem[]): PostcodeItem[] {
  const seen = new Set<string>();
  const out: PostcodeItem[] = [];
  for (const it of items) {
    const zip = String(it.zip || '').replace(/\s/g, '');
    const address = String(it.address || '').trim();
    if (!zip || !address) continue;
    const key = `${zip}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ zip, address });
  }
  return out;
}

async function fetchJson(url: string): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchJapanPostcode(q: string): Promise<PostcodeItem[]> {
  const zipDigits = q.replace(/[^\d]/g, '');
  const items: PostcodeItem[] = [];
  if (zipDigits.length >= 3 && zipDigits.length <= 7) {
    try {
      const data = (await fetchJson(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${encodeURIComponent(zipDigits)}`
      )) as { results?: Array<{ zipcode?: string; address1?: string; address2?: string; address3?: string }> };
      for (const row of data.results || []) {
        items.push({
          zip: String(row.zipcode || zipDigits),
          address: `${row.address1 || ''}${row.address2 || ''}${row.address3 || ''}`,
        });
      }
    } catch {
      /* fall through to keyword search */
    }
  }
  if (items.length === 0) {
    const data = (await fetchJson(
      `https://geoapi.heartrails.com/api/json?method=suggest&matching=like&keyword=${encodeURIComponent(q)}`
    )) as { response?: { location?: Array<{ postal?: string; prefecture?: string; city?: string; town?: string }> | { postal?: string; prefecture?: string; city?: string; town?: string } } };
    const loc = data.response?.location;
    const list = Array.isArray(loc) ? loc : loc ? [loc] : [];
    for (const row of list) {
      items.push({
        zip: String(row.postal || ''),
        address: `${row.prefecture || ''}${row.city || ''}${row.town || ''}`,
      });
    }
  }
  return uniqPostcodes(items);
}

router.get('/postcode', async (req, res) => {
  const country = String(req.query.country || '').toUpperCase();
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q required' });
  if (country !== 'JP') {
    return res.status(400).json({ error: 'Postal search is available for JP only on the server' });
  }
  try {
    const items = await searchJapanPostcode(q);
    res.json({ items });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message || 'Postal search failed' });
  }
});

router.put('/me/password', (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 4) return res.status(400).json({ error: 'password required (min 4)' });
  const op = operatorStore.getById(req.auth!.userId);
  if (!op) return res.status(400).json({ error: 'Operator account not found' });
  operatorStore.update(op.id, { password });
  res.json({ ok: true });
});

function parseFeeNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function parsePartnerFees(raw: unknown): PartnerFeePolicy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const fees: PartnerFeePolicy = {};
  const issue = parseFeeNumber(f.cardIssuanceFee);
  const topup = parseFeeNumber(f.cardTopUpFeePercent);
  const usage = parseFeeNumber(f.cardUsageFeePerTransaction);
  const monthly = parseFeeNumber(f.cardMonthlyFee);
  const partner = parseFeeNumber(f.partnerMonthlyFee);
  const plastic = parseFeeNumber(f.plasticIssuanceFee);
  if (issue != null) fees.cardIssuanceFee = issue;
  if (topup != null) fees.cardTopUpFeePercent = topup;
  if (usage != null) fees.cardUsageFeePerTransaction = usage;
  if (monthly != null) fees.cardMonthlyFee = monthly;
  if (partner != null) fees.partnerMonthlyFee = partner;
  if (plastic != null) fees.plasticIssuanceFee = plastic;
  return Object.keys(fees).length ? fees : undefined;
}

router.get('/users', (_, res) => {
  const users = Array.from(store.users.values()).map((u) => ({
    id: u.id,
    email: u.email,
    wirexUserId: u.wirexUserId,
    source: u.source || 'direct',
    partnerId: u.partnerId,
    country: u.country,
    kycStatus: u.kycStatus,
    status: u.status || 'active',
    createdAt: u.createdAt,
  }));
  res.json({ items: users, total: users.length });
});

router.get('/operators', (req, res) => {
  const scope = String(req.query.scope || '').toUpperCase();
  const list = operatorStore.list(scope === 'HQ' || scope === 'PARTNER' ? scope : undefined);
  const items = list.map((o) => ({
    ...operatorStore.publicView(o),
    partnerName: o.partnerId ? partnerStore.getById(o.partnerId)?.companyName || partnerStore.getById(o.partnerId)?.name : undefined,
  }));
  res.json({ items, total: items.length });
});

router.post('/operators', (req, res) => {
  const body = req.body ?? {};
  try {
    const op = operatorStore.create({
      email: String(body.email || ''),
      name: String(body.name || ''),
      password: String(body.password || ''),
      scope: body.scope === 'PARTNER' ? 'PARTNER' : 'HQ',
      role: body.role === 'STAFF' ? 'STAFF' : 'ADMIN',
      partnerId: body.partnerId,
      mustChangePassword: false,
    });
    res.status(201).json(operatorStore.publicView(op));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.put('/operators/:id', (req, res) => {
  const body = req.body ?? {};
  const op = operatorStore.update(req.params.id, {
    name: body.name,
    role: body.role,
    status: body.status,
    partnerId: body.partnerId,
    password: body.password,
  });
  if (!op) return res.status(404).json({ error: 'Not found' });
  res.json(operatorStore.publicView(op));
});

router.get('/members', (req, res) => {
  const source = String(req.query.source || '').toLowerCase();
  let list = Array.from(store.users.values());
  if (source === 'direct' || source === 'partner') {
    list = list.filter((u) => (u.source || 'direct') === source);
  }
  const items = list.map((u) => ({
    id: u.id,
    email: u.email,
    wirexUserId: u.wirexUserId,
    source: u.source || 'direct',
    partnerId: u.partnerId,
    partnerName: u.partnerId ? partnerStore.getById(u.partnerId)?.companyName || partnerStore.getById(u.partnerId)?.name : undefined,
    country: u.country,
    kycStatus: u.kycStatus,
    status: u.status || 'active',
    createdAt: u.createdAt,
  }));
  res.json({ items, total: items.length });
});

router.put('/members/:id', (req, res) => {
  const status = req.body?.status === 'suspended' ? 'suspended' : req.body?.status === 'active' ? 'active' : undefined;
  const user = store.updateMember(req.params.id, { status });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, status: user.status || 'active' });
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

router.get('/brand', (_, res) => {
  res.json(brandStore.get());
});

router.put('/brand', (req, res) => {
  const updated = brandStore.update(req.body ?? {});
  res.json(updated);
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
  const wirexUpdate: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string; environment?: 'sandbox' | 'production' } = {
    apiBase: typeof wirex.apiBase === 'string' ? wirex.apiBase : undefined,
    chainId: !isNaN(chainIdNum) ? chainIdNum : undefined,
    clientId: typeof wirex.clientId === 'string' ? wirex.clientId : undefined,
    environment: wirex.environment === 'production' || wirex.environment === 'sandbox' ? wirex.environment : undefined,
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
    businessNo: p.businessNo,
    ceoName: p.ceoName,
    phone: p.phone,
    orgUnitId: p.orgUnitId,
    orgParentId: p.orgParentId,
    orgParentName: p.orgParentId ? orgStore.get(p.orgParentId)?.name : undefined,
    cardIssuePolicy: issuePolicyFromPartner(p),
    allowVirtual: flagsFromIssuePolicy(issuePolicyFromPartner(p)).allowVirtual,
    allowPlastic: flagsFromIssuePolicy(issuePolicyFromPartner(p)).allowPlastic,
    apiKeyPrefix: p.apiKeyPrefix + '...',
    status: p.status,
    billingWalletAddress: p.billingWalletAddress,
    billingWarnings: p.billingWarnings ?? 0,
    lastBillingMonth: p.lastBillingMonth,
    fees: p.fees ?? {},
    feePolicyId: p.feePolicyId || '',
    feeOverride: Boolean(p.feeOverride),
    distribution: resolvePartnerPolicy(p).distribution,
    distributionApplyStart: p.distributionApplyStart,
    customFees: Boolean(p.feeOverride),
    feeSource: resolvePartnerPolicy(p).source,
    feeTemplateName: resolvePartnerPolicy(p).templateName,
    effectiveFees: feeSettings.getForPartner(p.id),
    createdAt: p.createdAt,
  }));
  res.json({ items, total: items.length });
});

router.post('/partners', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = body.name;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name required' });
  }
  const loginId = String(body.loginId || body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!loginId || !password) {
    return res.status(400).json({ error: 'loginId and password required' });
  }
  if (operatorStore.getByEmail(loginId)) {
    return res.status(400).json({ error: 'Login ID already registered' });
  }
  const profile = parseOrgProfile(body);
  const { partner, apiKey } = partnerStore.create({
    name,
    companyName: typeof body.companyName === 'string' ? body.companyName : name,
    businessNo: profile.businessNo,
    ceoName: profile.ceoName,
    phone: profile.phone || profile.mobile,
    orgParentId: typeof body.orgParentId === 'string' ? body.orgParentId : undefined,
    cardIssuePolicy: parseCardIssuePolicy(body.cardIssuePolicy) ?? issuePolicyFromPartner({
      allowVirtual: body.allowVirtual !== false,
      allowPlastic: body.allowPlastic === true,
    }),
    fees: parsePartnerFees(body.fees),
    feePolicyId: typeof body.feePolicyId === 'string' ? body.feePolicyId : undefined,
    distribution: body.distribution && typeof body.distribution === 'object' ? (body.distribution as Partner['distribution']) : undefined,
  });
  let orgCode = '';
  try {
    const merchantUnit = orgStore.create({
      orgLevel: 'MERCHANT',
      parentId: partner.orgParentId || 'org_hq',
      name: partner.companyName || partner.name,
      partnerId: partner.id,
      profile: { ...profile, loginId },
    });
    partnerStore.update(partner.id, { orgUnitId: merchantUnit.id, orgParentId: merchantUnit.parentId });
    const savedUnit = orgStore.get(merchantUnit.id)!;
    createOrgLogin(savedUnit, { ...body, loginId, password });
    orgCode = savedUnit.code;
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
  const saved = partnerStore.getById(partner.id) ?? partner;
  res.status(201).json({
    partner: saved,
    apiKey,
    loginId,
    orgCode,
    warning: 'API Key is shown only once. Save it securely. Share login ID/password with the company.',
  });
});

router.put('/partners/:id', (req, res) => {
  const { name, companyName, status, billingWalletAddress, fees, resetFees, businessNo, ceoName, phone, orgParentId, allowVirtual, allowPlastic, cardIssuePolicy, distribution, distributionApplyStart, feePolicyId } = req.body ?? {};
  const feeUpdate = resetFees === true ? {} : parsePartnerFees(fees);
  const issuePolicy = parseCardIssuePolicy(cardIssuePolicy);
  const updated = partnerStore.update(req.params.id, {
    name,
    companyName,
    status,
    billingWalletAddress: typeof billingWalletAddress === 'string' ? billingWalletAddress : undefined,
    ...(typeof feePolicyId === 'string'
      ? { feePolicyId: feePolicyId === 'hq' || feePolicyId === '' ? '' : feePolicyId }
      : {}),
    ...(resetFees === true
      ? { fees: {}, feeOverride: false }
      : feeUpdate !== undefined
        ? { fees: feeUpdate, feeOverride: true }
        : typeof feePolicyId === 'string'
          ? { fees: {}, feeOverride: false }
          : {}),
    businessNo,
    ceoName,
    phone,
    orgParentId,
    ...(issuePolicy ? { cardIssuePolicy: issuePolicy } : { allowVirtual, allowPlastic }),
    ...(distribution !== undefined ? { distribution } : {}),
    ...(typeof distributionApplyStart === 'string' ? { distributionApplyStart } : {}),
  });
  if (!updated) return res.status(404).json({ error: 'Partner not found' });
  res.json({
    id: updated.id,
    name: updated.name,
    companyName: updated.companyName,
    status: updated.status,
    fees: updated.fees ?? {},
    feePolicyId: updated.feePolicyId || '',
    feeOverride: Boolean(updated.feeOverride),
    customFees: Boolean(updated.feeOverride),
    feeSource: resolvePartnerPolicy(updated).source,
    feeTemplateName: resolvePartnerPolicy(updated).templateName,
    effectiveFees: feeSettings.getForPartner(updated.id),
    updatedAt: updated.updatedAt,
  });
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
      const fee = feeSettings.getForPartner(p.id).partnerMonthlyFee;
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

router.get('/webhooks', (_req, res) => {
  res.json({ items: webhookStore.list(100) });
});

export default router;
