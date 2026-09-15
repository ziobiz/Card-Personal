/**
 * 관리자 API - 사용자/카드 목록, 통계, 환경설정
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { requireAdmin } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { config } from '../config.js';
import { settingsStore } from '../data/settingsStore.js';
import { partnerStore, type PartnerFeePolicy, type Partner, parseCardIssuePolicy, issuePolicyFromPartner, flagsFromIssuePolicy } from '../data/partnerStore.js';
import { parseDeliveryMode } from '../lib/partnerCredentials.js';
import { invalidateWirexClient } from '../clients/wirex/wirexClients.js';
import { feeSettings } from '../data/feeSettings.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { webhookStore } from '../data/webhookStore.js';
import { orgStore, parseOrgProfile } from '../data/orgStore.js';
import { createOrgLogin } from '../data/orgLogin.js';
import { brandStore } from '../data/brandStore.js';
import { packageManifest } from '../data/packageManifest.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';
import { getWirexBaaSConfig } from '../config.js';
import { resolvePartnerPolicy } from '../data/feePolicyTemplateStore.js';
import { operatorStore } from '../data/operatorStore.js';
import { accessGroupStore } from '../data/accessGroupStore.js';
import { accessAuditStore } from '../data/accessAuditStore.js';
import adminSales from './adminSales.js';
import { generateOtpSecret, otpAuthUrl, verifyTotp } from '../lib/totp.js';
import { getSecuritySettings, maskEmail } from '../lib/otpPolicy.js';
import { HQ_MENU_KEYS, PARTNER_MENU_KEYS } from '../lib/accessMenus.js';
import { resolveOperatorMenus } from '../lib/resolveAccess.js';
import { canManageHqAccess, defaultGroupId, hqActor, partnerHasSuper, writeAudit } from '../lib/accessActor.js';
import { manualsFor } from '../lib/manualCatalog.js';
import { requireTurnstile } from '../lib/turnstile.js';

const router = Router();

function signAdmin(userId: string, email: string, extra: Record<string, unknown> = {}) {
  return jwt.sign({ userId, email, isAdmin: true, ...extra }, config.jwtSecret, { expiresIn: '24h' });
}

function signAdminEnroll(userId: string) {
  return jwt.sign({ userId, purpose: 'admin_otp_enroll', isAdmin: true }, config.jwtSecret, { expiresIn: '15m' });
}

function verifyAdminEnroll(token: string): string | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId?: string; purpose?: string };
    if (decoded.purpose !== 'admin_otp_enroll' || !decoded.userId) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

router.post('/login', async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
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
  let op = operatorStore.getByEmail(emailNorm);
  const passwordHash = operatorStore.hashPassword(String(password));
  const hqOk =
    (allowedEmails.has(emailNorm) && password === config.adminPassword) ||
    (op && op.scope === 'HQ' && op.status === 'active' && op.passwordHash === passwordHash);
  if (!hqOk) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  if (!op) {
    op = operatorStore.getByEmail(emailNorm);
  }
  if (!op) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  if (op.mustChangePassword) {
    const token = signAdmin(op.id, emailNorm);
    return res.json({
      token,
      user: { email: emailNorm, isAdmin: true, name: op.name },
      mustChangePassword: true,
      otpRequired: false,
    });
  }

  const sec = getSecuritySettings();
  if (sec.otpRequiredAdmin) {
    if (!op.otpEnabled || !op.otpSecret) {
      return res.json({
        mustSetupOtp: true,
        enrollToken: signAdminEnroll(op.id),
        maskedEmail: maskEmail(emailNorm),
        user: { email: emailNorm, isAdmin: true, name: op.name },
        mustChangePassword: false,
        otpRequired: false,
      });
    }
    const token = signAdmin(op.id, emailNorm, { otpPending: true });
    return res.json({
      token,
      user: { email: emailNorm, isAdmin: true, name: op.name },
      mustChangePassword: false,
      otpRequired: true,
      otpMethod: 'totp',
      maskedEmail: maskEmail(emailNorm),
    });
  }

  const token = signAdmin(op.id, emailNorm);
  res.json({
    token,
    user: { email: emailNorm, isAdmin: true, name: op.name },
    mustChangePassword: false,
    otpRequired: false,
  });
});

router.post('/otp/setup', (req, res) => {
  const enrollToken = String(req.body?.enrollToken || '');
  const userId = verifyAdminEnroll(enrollToken);
  if (!userId) return res.status(401).json({ error: 'Invalid enroll session' });
  const op = operatorStore.getById(userId);
  if (!op || op.scope !== 'HQ') return res.status(404).json({ error: 'Operator not found' });
  const secret = generateOtpSecret();
  operatorStore.update(op.id, { otpSecret: secret, otpEnabled: false });
  res.json({
    secret,
    otpauthUrl: otpAuthUrl(op.email, secret, 'ICOCARD Admin'),
    enrollToken,
    maskedEmail: maskEmail(op.email),
  });
});

router.post('/otp/activate', (req, res) => {
  const enrollToken = String(req.body?.enrollToken || '');
  const code = String(req.body?.code || '');
  const userId = verifyAdminEnroll(enrollToken);
  if (!userId) return res.status(401).json({ error: 'Invalid enroll session' });
  const op = operatorStore.getById(userId);
  if (!op?.otpSecret) return res.status(400).json({ error: 'OTP not provisioned' });
  if (!verifyTotp(op.otpSecret, code)) return res.status(401).json({ error: 'Invalid OTP' });
  operatorStore.update(op.id, { otpEnabled: true });
  const token = signAdmin(op.id, op.email);
  res.json({ token, user: { email: op.email, isAdmin: true, name: op.name } });
});

router.post('/otp/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(auth.slice(7), config.jwtSecret) as {
      userId?: string;
      email?: string;
      isAdmin?: boolean;
      otpPending?: boolean;
    };
    if (!decoded.isAdmin || !decoded.userId) return res.status(401).json({ error: 'Unauthorized' });
    const op = operatorStore.getById(decoded.userId);
    if (!op?.otpSecret) return res.status(400).json({ error: 'OTP not provisioned' });
    const sec = getSecuritySettings();
    if (!sec.otpRequiredAdmin) {
      const token = signAdmin(op.id, op.email);
      return res.json({ token, otpRequired: false });
    }
    if (!verifyTotp(op.otpSecret, String(req.body?.code || ''))) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }
    const token = signAdmin(op.id, op.email);
    res.json({ token, user: { email: op.email, isAdmin: true, name: op.name } });
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

router.use(requireAdmin);
router.use(adminSales);

router.get('/me', (req, res) => {
  const op = hqActor(req);
  if (!op) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    ...operatorStore.publicView(op),
    allowedMenus: resolveOperatorMenus(op),
    catalog: HQ_MENU_KEYS,
  });
});

router.get('/manuals', (req, res) => {
  const op = hqActor(req);
  if (!op) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ items: manualsFor({ audience: 'hq' }), ready: false });
});

router.get('/access/groups', (req, res) => {
  const op = hqActor(req);
  if (!op || op.scope !== 'HQ') return res.status(403).json({ error: 'Access denied' });
  const owner = String(req.query.owner || 'HQ');
  const safe = owner === 'HQ' || Boolean(partnerStore.getById(owner)) ? owner : 'HQ';
  res.json({
    items: accessGroupStore.list(safe),
    catalog: safe === 'HQ' ? HQ_MENU_KEYS : PARTNER_MENU_KEYS,
    owner: safe,
  });
});

router.post('/access/groups', (req, res) => {
  const op = hqActor(req);
  if (!op || !canManageHqAccess(op)) return res.status(403).json({ error: 'Access denied' });
  const owner = String(req.body?.owner || 'HQ');
  const safe = owner === 'HQ' || Boolean(partnerStore.getById(owner)) ? owner : 'HQ';
  const group = accessGroupStore.create({
    owner: safe,
    name: String(req.body?.name || ''),
    menus: req.body?.menus,
    code: req.body?.code,
  });
  writeAudit({ actor: op, owner: safe, targetType: 'group', targetId: group.id, action: 'create', detail: group.name });
  res.status(201).json(group);
});

router.put('/access/groups/:id', (req, res) => {
  const op = hqActor(req);
  if (!op || !canManageHqAccess(op)) return res.status(403).json({ error: 'Access denied' });
  const current = accessGroupStore.get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Not found' });
  const group = accessGroupStore.update(req.params.id, { name: req.body?.name, menus: req.body?.menus });
  writeAudit({
    actor: op,
    owner: current.owner,
    targetType: 'group',
    targetId: current.id,
    action: 'menus',
    detail: `${group?.name || current.name}:${(group?.menus || []).join(',')}`,
  });
  res.json(group);
});

router.delete('/access/groups/:id', (req, res) => {
  const op = hqActor(req);
  if (!op || !canManageHqAccess(op)) return res.status(403).json({ error: 'Access denied' });
  const current = accessGroupStore.get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Not found' });
  if (!accessGroupStore.remove(req.params.id)) return res.status(400).json({ error: 'Built-in group cannot be deleted' });
  writeAudit({ actor: op, owner: current.owner, targetType: 'group', targetId: current.id, action: 'update', detail: `removed ${current.name}` });
  res.json({ ok: true });
});

router.get('/access/history', (req, res) => {
  const op = hqActor(req);
  if (!canManageHqAccess(op)) return res.status(403).json({ error: 'Access denied' });
  const owner = req.query.owner ? String(req.query.owner) : undefined;
  const targetId = req.query.targetId ? String(req.query.targetId) : undefined;
  res.json({ items: accessAuditStore.list(owner, targetId) });
});

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
  const refreshed = operatorStore.getById(op.id)!;
  const sec = getSecuritySettings();
  if (sec.otpRequiredAdmin) {
    if (!refreshed.otpEnabled || !refreshed.otpSecret) {
      return res.json({
        ok: true,
        mustSetupOtp: true,
        enrollToken: signAdminEnroll(refreshed.id),
        maskedEmail: maskEmail(refreshed.email),
      });
    }
    const token = signAdmin(refreshed.id, refreshed.email, { otpPending: true });
    return res.json({ ok: true, otpRequired: true, token, maskedEmail: maskEmail(refreshed.email) });
  }
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
  const actor = hqActor(req);
  if (!actor?.isSuper) return res.status(403).json({ error: 'Super admin required' });
  const body = req.body ?? {};
  try {
    const scope = body.scope === 'PARTNER' ? 'PARTNER' : 'HQ';
    const partnerId = scope === 'PARTNER' ? String(body.partnerId || '') : undefined;
    const owner = scope === 'PARTNER' && partnerId ? partnerId : 'HQ';
    const groupId = String(body.groupId || defaultGroupId(owner));
    const created = operatorStore.create({
      email: String(body.email || ''),
      name: String(body.name || ''),
      password: String(body.password || ''),
      scope,
      role: body.role === 'STAFF' ? 'STAFF' : 'ADMIN',
      partnerId,
      groupId,
      menuOverride: Array.isArray(body.menuOverride) ? body.menuOverride.map(String) : undefined,
      isSuper: scope === 'HQ' ? Boolean(body.isSuper) : !partnerHasSuper(partnerId || ''),
      mustChangePassword: false,
    });
    writeAudit({
      actor,
      owner,
      targetType: 'operator',
      targetId: created.id,
      action: 'create',
      detail: `${created.email} ${created.scope} ${created.groupId || ''}`,
    });
    res.status(201).json(operatorStore.publicView(created));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.put('/operators/:id', (req, res) => {
  const actor = hqActor(req);
  if (!actor || (!actor.isSuper && !canManageHqAccess(actor))) return res.status(403).json({ error: 'Access denied' });
  const body = req.body ?? {};
  const before = operatorStore.getById(req.params.id);
  if (!before) return res.status(404).json({ error: 'Not found' });
  const op = operatorStore.update(req.params.id, {
    name: body.name,
    role: body.role,
    status: body.status,
    partnerId: body.partnerId,
    password: body.password,
    groupId: body.groupId,
    menuOverride: body.menuOverride,
    isSuper: actor.isSuper ? body.isSuper : undefined,
  });
  if (!op) return res.status(404).json({ error: 'Not found' });
  const owner = op.scope === 'PARTNER' && op.partnerId ? op.partnerId : 'HQ';
  const action =
    body.password ? 'password' : body.status && body.status !== before.status ? 'status' : body.groupId !== undefined ? 'group' : body.menuOverride ? 'menus' : 'update';
  writeAudit({
    actor,
    owner,
    targetType: 'operator',
    targetId: op.id,
    action,
    detail: `${op.email} group=${op.groupId || ''} menus=${(op.menuOverride || []).join(',')}`,
  });
  res.json(operatorStore.publicView(op));
});

router.post('/operators/:id/reset-otp', (req, res) => {
  const actor = hqActor(req);
  if (!actor) return res.status(401).json({ error: 'Unauthorized' });
  const op = operatorStore.update(req.params.id, { clearOtp: true });
  if (!op) return res.status(404).json({ error: 'Not found' });
  writeAudit({
    actor,
    owner: op.scope === 'PARTNER' && op.partnerId ? op.partnerId : 'HQ',
    targetType: 'operator',
    targetId: op.id,
    action: 'otp',
    detail: `reset otp ${op.email}`,
  });
  res.json({ ok: true, otpEnabled: false });
});

router.post('/members/:id/reset-otp', (req, res) => {
  const user = store.updateOtp(req.params.id, { otpSecret: null, otpEnabled: false });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, otpEnabled: false });
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
    displayName: u.displayName,
    kycStatus: u.kycStatus,
    otpEnabled: Boolean(u.otpEnabled),
    status: u.status || 'active',
    createdAt: u.createdAt,
  }));
  res.json({ items, total: items.length });
});

router.put('/members/:id', (req, res) => {
  const allowed = ['active', 'suspended', 'pending', 'rejected'] as const;
  const raw = typeof req.body?.status === 'string' ? req.body.status : '';
  const status = (allowed as readonly string[]).includes(raw) ? (raw as (typeof allowed)[number]) : undefined;
  if (!status) return res.status(400).json({ error: 'Invalid status', code: 'invalid_status' });
  const user = store.updateMember(req.params.id, { status });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, status: user.status || 'active' });
});

router.post('/members/:id/reset-password', (req, res) => {
  const user = store.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const password = typeof req.body?.password === 'string' && req.body.password.length >= 6
    ? req.body.password
    : randomBytes(5).toString('hex');
  const hash = createHash('sha256').update(password + config.jwtSecret).digest('hex');
  store.updatePassword(user.id, hash);
  store.updateOtp(user.id, { otpSecret: null, otpEnabled: false });
  res.json({ ok: true, email: user.email, password, warning: 'Shown once. Customer must change after login.' });
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

/** Restore factory PG chrome colors (presets kept) */
router.post('/brand/colors/reset', (_req, res) => {
  res.json(brandStore.resetColors());
});

/** Apply named preset slot 0–2 to current colors */
router.post('/brand/colors/apply-preset', (req, res) => {
  const slot = Number(req.body?.slot);
  if (!Number.isFinite(slot) || slot < 0 || slot > 2) {
    return res.status(400).json({ error: 'slot must be 0, 1, or 2' });
  }
  res.json(brandStore.applyPreset(slot));
});

/** Save current colors into preset slot with optional name */
router.post('/brand/colors/save-preset', (req, res) => {
  const slot = Number(req.body?.slot);
  if (!Number.isFinite(slot) || slot < 0 || slot > 2) {
    return res.status(400).json({ error: 'slot must be 0, 1, or 2' });
  }
  const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
  res.json(brandStore.savePreset(slot, name));
});

/** Apply factory default colors (same as reset) */
router.post('/brand/colors/apply-default', (_req, res) => {
  res.json(brandStore.resetColors());
});

/** Sellable package / white-label deployment profile (no Wirex secrets) */
router.get('/package', (_, res) => {
  res.json(packageManifest.publicView());
});

router.put('/package', (req, res) => {
  packageManifest.update(req.body ?? {});
  res.json(packageManifest.publicView());
});

/** ASP / Sandbox ops — connection + optional live smoke (requires on-chain EOA) */
router.get('/sandbox/status', async (_req, res) => {
  const w = getWirexBaaSConfig();
  const out: Record<string, unknown> = {
    environment: w.environment,
    mock: config.useMockWirex,
    apiBase: w.apiBase,
    chainId: w.chainId,
    clientIdSet: Boolean(w.clientId),
    partnerId: w.partnerId,
    webhookBaseUrl: packageManifest.get().webhookBaseUrl,
    brand: brandStore.get().productName,
    enabledLocales: brandStore.get().enabledLocales,
  };
  if (config.useMockWirex) {
    out.tokenOk = false;
    out.note = 'Mock mode — set USE_MOCK_WIREX=false with Sandbox keys for live calls';
    return res.json(out);
  }
  try {
    const token = await wirexClient.getAccessToken();
    out.tokenOk = true;
    out.tokenPreview = `${token.slice(0, 18)}…`;
    try {
      out.validationRules = await wirexClient.getValidationRules();
    } catch (e) {
      out.validationRulesError = (e as Error).message;
    }
  } catch (e) {
    out.tokenOk = false;
    out.tokenError = (e as Error).message;
  }
  res.json(out);
});

router.post('/sandbox/smoke', async (req, res) => {
  req.setTimeout(180000);
  res.setTimeout(180000);
  if (config.useMockWirex) {
    return res.status(400).json({ error: 'Disable mock mode before live smoke test' });
  }
  try {
    const email = String(req.body?.email || 'sandbox.ops@icocard.net').trim().toLowerCase();
    store.loadUsers();
    let user = store.getUserByEmail(email);
    if (!user) {
      store.addUser({
        id: uuidv4(),
        email,
        passwordHash: '[smoke]',
        country: 'GB',
        source: 'direct',
        onboardingStatus: 'none',
        createdAt: new Date().toISOString(),
      });
      user = store.getUserByEmail(email);
    }
    if (!user) return res.status(500).json({ error: 'Failed to create smoke user' });
    const { onboardingService } = await import('../services/onboardingService.js');
    const result = await onboardingService.run(user.id, { issueCard: true, mint: true });
    res.json({
      ...result,
      email,
      userId: user.id,
      wallet: result.onboarding.eoa,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/settings', (_, res) => {
  const s = settingsStore.get();
  const sec = getSecuritySettings();
  res.json({
    wirex: s.wirex ?? {},
    feePolicy: s.feePolicy ?? {},
    security: sec,
    useMockWirex: s.useMockWirex ?? true,
    walletPolicy: s.walletPolicy ?? { embedded: true, externalEoa: true, bridge: true },
    memberRegistration: s.memberRegistration ?? { mode: 'open' },
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
  const securityBody = body.security ?? {};
  const securityUpdate: {
    otpRequiredAdmin?: boolean;
    otpRequiredMember?: boolean;
    otpRequiredOrg?: boolean;
  } = {};
  if (typeof securityBody.otpRequiredAdmin === 'boolean') securityUpdate.otpRequiredAdmin = securityBody.otpRequiredAdmin;
  if (typeof securityBody.otpRequiredMember === 'boolean') securityUpdate.otpRequiredMember = securityBody.otpRequiredMember;
  if (typeof securityBody.otpRequiredOrg === 'boolean') securityUpdate.otpRequiredOrg = securityBody.otpRequiredOrg;
  const wp = body.walletPolicy ?? {};
  const walletPolicyUpdate: { embedded?: boolean; externalEoa?: boolean; bridge?: boolean } = {};
  if (typeof wp.embedded === 'boolean') walletPolicyUpdate.embedded = wp.embedded;
  if (typeof wp.externalEoa === 'boolean') walletPolicyUpdate.externalEoa = wp.externalEoa;
  if (typeof wp.bridge === 'boolean') walletPolicyUpdate.bridge = wp.bridge;
  const mr = body.memberRegistration ?? {};
  const memberRegistrationUpdate: { mode?: 'open' | 'approval' } = {};
  if (mr.mode === 'open' || mr.mode === 'approval') memberRegistrationUpdate.mode = mr.mode;
  settingsStore.update({
    wirex: wirexUpdate,
    useMockWirex,
    feePolicy: feePolicyUpdate,
    ...(Object.keys(securityUpdate).length ? { security: securityUpdate } : {}),
    ...(Object.keys(walletPolicyUpdate).length ? { walletPolicy: walletPolicyUpdate } : {}),
    ...(Object.keys(memberRegistrationUpdate).length ? { memberRegistration: memberRegistrationUpdate } : {}),
  });
  const s = settingsStore.get();
  res.json({
    wirex: s.wirex ?? {},
    feePolicy: s.feePolicy ?? {},
    security: getSecuritySettings(),
    useMockWirex: s.useMockWirex ?? true,
    walletPolicy: s.walletPolicy ?? { embedded: true, externalEoa: true, bridge: true },
    memberRegistration: s.memberRegistration ?? { mode: 'open' },
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
    mid: p.mid || '',
    deliveryMode: p.deliveryMode || 'api',
    walletPolicySource: p.walletPolicySource === 'custom' ? 'custom' : 'follow_hq',
    walletModes: partnerStore.publicCredentialView(p).walletModes,
    canRedistributeKeys: partnerStore.publicCredentialView(p).canRedistributeKeys,
    wirexConfigured: partnerStore.publicCredentialView(p).wirexConfigured,
    isolation: partnerStore.publicCredentialView(p).isolation,
    solutionSlug: p.solutionSlug || '',
    solutionUrl: partnerStore.publicCredentialView(p).solutionUrl,
    credentials: partnerStore.publicCredentialView(p),
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
  const { partner, apiKey, kit } = partnerStore.create({
    name,
    companyName: typeof body.companyName === 'string' ? body.companyName : name,
    businessNo: profile.businessNo,
    ceoName: profile.ceoName,
    phone: profile.phone || profile.mobile,
    orgParentId:
      parseDeliveryMode(body.deliveryMode) === 'sub_solution_standalone' && body.salesOrgEnabled === true && typeof body.orgParentId === 'string'
        ? body.orgParentId
        : undefined,
    cardIssuePolicy: parseCardIssuePolicy(body.cardIssuePolicy) ?? issuePolicyFromPartner({
      allowVirtual: body.allowVirtual !== false,
      allowPlastic: body.allowPlastic === true,
    }),
    deliveryMode: parseDeliveryMode(body.deliveryMode),
    salesOrgEnabled: body.salesOrgEnabled === true,
    walletPolicySource: body.walletPolicySource === 'custom' ? 'custom' : 'follow_hq',
    walletModes: {
      embedded: body.walletEmbedded !== false,
      externalEoa: body.walletExternal !== false,
      bridge: body.walletBridge !== false,
    },
    webhookUrl: typeof body.webhookUrl === 'string' ? body.webhookUrl : undefined,
    solutionName: typeof body.solutionName === 'string' ? body.solutionName : undefined,
    bridgeDebitUrl: typeof body.bridgeDebitUrl === 'string' ? body.bridgeDebitUrl : undefined,
    wirexClientId: typeof body.wirexClientId === 'string' ? body.wirexClientId : undefined,
    wirexClientSecret: typeof body.wirexClientSecret === 'string' ? body.wirexClientSecret : undefined,
    wirexPartnerId: typeof body.wirexPartnerId === 'string' ? body.wirexPartnerId : undefined,
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
    kit,
    loginId,
    orgCode,
    warning: kit
      ? 'ICOCARD keys are shown only once. Never share Wirex keys. Share login ID/password with the company.'
      : 'Standalone operator: operations login only. No ICOCARD reseller keys. Configure the merchant Wirex contract keys.',
  });
});

router.put('/partners/:id', (req, res) => {
  const { name, companyName, status, billingWalletAddress, fees, resetFees, businessNo, ceoName, phone, orgParentId, allowVirtual, allowPlastic, cardIssuePolicy, distribution, distributionApplyStart, feePolicyId, deliveryMode, walletModes, walletPolicySource, webhookUrl, solutionSlug, solutionName, bridgeDebitUrl, allowedIps } = req.body ?? {};
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
    ...(deliveryMode === 'api' || deliveryMode === 'sub_solution' || deliveryMode === 'sub_solution_standalone' ? { deliveryMode } : {}),
    ...(walletPolicySource === 'follow_hq' || walletPolicySource === 'custom' ? { walletPolicySource } : {}),
    ...(walletModes && typeof walletModes === 'object' ? { walletModes } : {}),
    ...(typeof webhookUrl === 'string' ? { webhookUrl } : {}),
    ...(typeof solutionSlug === 'string' ? { solutionSlug } : {}),
    ...(typeof solutionName === 'string' ? { solutionName } : {}),
    ...(typeof bridgeDebitUrl === 'string' ? { bridgeDebitUrl } : {}),
    ...(Array.isArray(allowedIps) ? { allowedIps: allowedIps.map(String) } : {}),
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
  const existing = partnerStore.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Partner not found' });
  if (existing.deliveryMode === 'sub_solution_standalone') {
    return res.status(400).json({ error: 'Standalone operators do not receive ICOCARD reseller keys' });
  }
  const result = partnerStore.regenerateApiKey(req.params.id);
  if (!result) return res.status(404).json({ error: 'Partner not found' });
  res.json({
    partner: { id: result.partner.id, name: result.partner.name, status: result.partner.status },
    apiKey: result.apiKey,
    kit: result.kit,
    warning: 'Previous credentials are invalidated. MID / API Key / Secret / HMAC shown only once. Never use Wirex keys.',
  });
});

router.post('/partners/:id/standalone-wirex', (req, res) => {
  const p = partnerStore.getById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Partner not found' });
  if (p.deliveryMode !== 'sub_solution_standalone') {
    return res.status(400).json({ error: 'Wirex contract keys are only stored for standalone operators' });
  }
  const clientId = String(req.body?.clientId || req.body?.wirexClientId || '');
  const clientSecret = String(req.body?.clientSecret || req.body?.wirexClientSecret || '');
  const partnerId = typeof req.body?.wirexPartnerId === 'string' ? req.body.wirexPartnerId : undefined;
  if (!clientId || !clientSecret) return res.status(400).json({ error: 'clientId and clientSecret required' });
  const updated = partnerStore.setStandaloneWirexKeys(req.params.id, clientId, clientSecret);
  if (partnerId) partnerStore.update(req.params.id, { wirexPartnerId: partnerId });
  invalidateWirexClient(req.params.id);
  res.json({
    id: updated?.id,
    wirexConfigured: true,
    warning: 'Tenant Wirex keys stored encrypted. ICOCARD HQ keys are not used for this operator.',
  });
});

router.get('/webhooks', (_req, res) => {
  res.json({ items: webhookStore.list(100) });
});

export default router;
