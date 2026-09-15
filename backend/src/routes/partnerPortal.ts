import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { operatorStore } from '../data/operatorStore.js';
import { partnerStore, issuePolicyFromPartner, flagsFromIssuePolicy } from '../data/partnerStore.js';
import { feeSettings } from '../data/feeSettings.js';
import { resolvePartnerPolicy } from '../data/feePolicyTemplateStore.js';
import { generateOtpSecret, otpAuthUrl, verifyTotp } from '../lib/totp.js';
import { getSecuritySettings } from '../lib/otpPolicy.js';
import { accessGroupStore } from '../data/accessGroupStore.js';
import { accessAuditStore } from '../data/accessAuditStore.js';
import { PARTNER_MENU_KEYS } from '../lib/accessMenus.js';
import { canUseMenu, resolveOperatorMenus } from '../lib/resolveAccess.js';
import { canManagePartnerAccess, defaultGroupId, partnerActor, writeAudit } from '../lib/accessActor.js';
import { manualsFor } from '../lib/manualCatalog.js';
import { requireTurnstile } from '../lib/turnstile.js';

const router = Router();

type PartnerClaims = {
  operatorId?: string;
  partnerId?: string;
  isPartner?: boolean;
  otpPending?: boolean;
  email?: string;
};

function signPartner(op: { id: string; partnerId?: string; email: string }, extra: object = {}) {
  return jwt.sign(
    { operatorId: op.id, partnerId: op.partnerId, email: op.email, isPartner: true, ...extra },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
}

function readToken(req: Request): PartnerClaims | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), config.jwtSecret) as PartnerClaims;
  } catch {
    return null;
  }
}

function requirePartnerPortal(req: Request, res: Response, next: NextFunction): void {
  const decoded = readToken(req);
  if (!decoded?.isPartner || !decoded.operatorId || !decoded.partnerId || decoded.otpPending) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const op = operatorStore.getById(decoded.operatorId);
  if (!op || op.scope !== 'PARTNER' || op.status !== 'active' || op.partnerId !== decoded.partnerId) {
    res.status(403).json({ error: 'Operator inactive' });
    return;
  }
  req.auth = {
    userId: decoded.operatorId,
    email: decoded.email || op.email,
    isAdmin: false,
    isPartner: true,
    partnerId: decoded.partnerId,
  };
  next();
}

router.post('/login', async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const op = operatorStore.getByEmail(email);
  if (!op || op.scope !== 'PARTNER' || op.status !== 'active') {
    return res.status(401).json({ error: 'Invalid partner credentials' });
  }
  if (op.passwordHash !== operatorStore.hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid partner credentials' });
  }
  if (!op.partnerId) return res.status(403).json({ error: 'No partner assigned' });
  const partner = partnerStore.getById(op.partnerId);
  if (!partner || partner.status !== 'active') {
    return res.status(403).json({ error: 'Partner suspended' });
  }
  const sec = getSecuritySettings();
  let current = op;
  if (sec.otpRequiredOrg) {
    if (!current.otpSecret) {
      current = operatorStore.update(current.id, { otpSecret: generateOtpSecret(), otpEnabled: false }) || current;
    }
    const mustSetup = !current.otpEnabled;
    const token = signPartner(current, { otpPending: true });
    return res.json({
      token,
      otpRequired: true,
      mustSetupOtp: mustSetup,
      otpEnabled: Boolean(current.otpEnabled),
      mustChangePassword: Boolean(current.mustChangePassword),
      operator: { id: current.id, email: current.email, name: current.name, role: current.role },
      partner: { id: partner.id, name: partner.name, companyName: partner.companyName },
    });
  }
  const token = signPartner(current);
  res.json({
    token,
    otpRequired: false,
    otpEnabled: Boolean(current.otpEnabled),
    mustChangePassword: Boolean(current.mustChangePassword),
    operator: { id: current.id, email: current.email, name: current.name, role: current.role },
    partner: { id: partner.id, name: partner.name, companyName: partner.companyName },
  });
});

router.post('/otp/verify', (req, res) => {
  const decoded = readToken(req);
  if (!decoded?.operatorId || !decoded.partnerId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const op = operatorStore.getById(decoded.operatorId);
  if (!op || op.scope !== 'PARTNER' || !op.otpSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!verifyTotp(op.otpSecret, String(req.body?.code || ''))) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }
  if (!op.otpEnabled) {
    operatorStore.update(op.id, { otpEnabled: true });
  }
  const partner = partnerStore.getById(op.partnerId!);
  res.json({
    token: signPartner(op),
    mustChangePassword: Boolean(op.mustChangePassword),
    operator: { id: op.id, email: op.email, name: op.name, role: op.role },
    partner: partner ? { id: partner.id, name: partner.name, companyName: partner.companyName } : undefined,
  });
});

router.get('/otp/setup', (req, res) => {
  const decoded = readToken(req);
  if (!decoded?.operatorId) return res.status(401).json({ error: 'Unauthorized' });
  let op = operatorStore.getById(decoded.operatorId);
  if (!op) return res.status(404).json({ error: 'OTP not provisioned' });
  if (!op.otpSecret) {
    op = operatorStore.update(op.id, { otpSecret: generateOtpSecret(), otpEnabled: false }) || op;
  }
  res.json({
    otpEnabled: Boolean(op.otpEnabled),
    otpRequired: getSecuritySettings().otpRequiredOrg,
    otpauthUrl: otpAuthUrl(op.email, op.otpSecret!),
    secret: op.otpSecret,
  });
});

router.put('/password', (req, res) => {
  const decoded = readToken(req);
  if (!decoded?.operatorId) return res.status(401).json({ error: 'Unauthorized' });
  const password = String(req.body?.password || '');
  if (password.length < 4) return res.status(400).json({ error: 'password required (min 4)' });
  const op = operatorStore.update(decoded.operatorId, { password });
  if (!op) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, mustChangePassword: false });
});

router.get('/me', requirePartnerPortal, (req, res) => {
  const me = partnerActor(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const partner = partnerStore.getById(me.partnerId || '');
  res.json({
    ...operatorStore.publicView(me),
    allowedMenus: resolveOperatorMenus(me),
    catalog: PARTNER_MENU_KEYS,
    deliveryMode: partner?.deliveryMode || 'api',
    canManageAccess: canManagePartnerAccess(me),
  });
});

router.get('/manuals', requirePartnerPortal, (req, res) => {
  const me = partnerActor(req);
  if (!me) return res.status(401).json({ error: 'Unauthorized' });
  const partner = partnerStore.getById(me.partnerId || '');
  res.json({
    items: manualsFor({ audience: 'partner', delivery: partner?.deliveryMode || 'api' }),
    deliveryMode: partner?.deliveryMode || 'api',
    ready: false,
  });
});

router.get('/access/groups', requirePartnerPortal, (req, res) => {
  const me = partnerActor(req);
  if (!me || !canManagePartnerAccess(me) || !me.partnerId) return res.status(403).json({ error: 'Access denied' });
  res.json({ items: accessGroupStore.list(me.partnerId), catalog: PARTNER_MENU_KEYS, owner: me.partnerId });
});

router.post('/access/groups', requirePartnerPortal, (req, res) => {
  const me = partnerActor(req);
  if (!me || !canManagePartnerAccess(me) || !me.partnerId) return res.status(403).json({ error: 'Access denied' });
  const group = accessGroupStore.create({
    owner: me.partnerId,
    name: String(req.body?.name || ''),
    menus: req.body?.menus,
    code: req.body?.code,
  });
  writeAudit({ actor: me, owner: me.partnerId, targetType: 'group', targetId: group.id, action: 'create', detail: group.name });
  res.status(201).json(group);
});

router.put('/access/groups/:id', requirePartnerPortal, (req, res) => {
  const me = partnerActor(req);
  if (!me || !canManagePartnerAccess(me) || !me.partnerId) return res.status(403).json({ error: 'Access denied' });
  const current = accessGroupStore.get(req.params.id);
  if (!current || current.owner !== me.partnerId) return res.status(404).json({ error: 'Not found' });
  const group = accessGroupStore.update(req.params.id, { name: req.body?.name, menus: req.body?.menus });
  writeAudit({
    actor: me,
    owner: me.partnerId,
    targetType: 'group',
    targetId: current.id,
    action: 'menus',
    detail: `${group?.name || current.name}:${(group?.menus || []).join(',')}`,
  });
  res.json(group);
});

router.get('/access/history', requirePartnerPortal, (req, res) => {
  const me = partnerActor(req);
  if (!me || !canManagePartnerAccess(me) || !me.partnerId) return res.status(403).json({ error: 'Access denied' });
  res.json({ items: accessAuditStore.list(me.partnerId, req.query.targetId ? String(req.query.targetId) : undefined) });
});

router.get('/staff', requirePartnerPortal, (req, res) => {
  const partnerId = req.auth!.partnerId!;
  const me = operatorStore.getById(req.auth!.userId);
  const items = operatorStore
    .list('PARTNER')
    .filter((o) => o.partnerId === partnerId)
    .map((o) => operatorStore.publicView(o));
  res.json({
    items,
    total: items.length,
    canAdd: Boolean(me && (me.isSuper || me.role === 'ADMIN')),
    groups: accessGroupStore.list(partnerId),
    catalog: PARTNER_MENU_KEYS,
  });
});

router.post('/staff', requirePartnerPortal, (req, res) => {
  const me = operatorStore.getById(req.auth!.userId);
  if (!me || !(me.isSuper || me.role === 'ADMIN')) return res.status(403).json({ error: 'Admin role required to add users' });
  try {
    const op = operatorStore.create({
      email: String(req.body?.email || ''),
      name: String(req.body?.name || ''),
      password: String(req.body?.password || ''),
      scope: 'PARTNER',
      role: req.body?.role === 'STAFF' ? 'STAFF' : 'ADMIN',
      partnerId: me.partnerId,
      groupId: String(req.body?.groupId || defaultGroupId(me.partnerId || '')),
      menuOverride: Array.isArray(req.body?.menuOverride) ? req.body.menuOverride.map(String) : undefined,
      mustChangePassword: true,
    });
    writeAudit({
      actor: me,
      owner: me.partnerId || '',
      targetType: 'operator',
      targetId: op.id,
      action: 'create',
      detail: `${op.email} ${op.groupId || ''}`,
    });
    res.status(201).json({ operator: operatorStore.publicView(op) });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.put('/staff/:id', requirePartnerPortal, (req, res) => {
  const me = operatorStore.getById(req.auth!.userId);
  if (!me || !(me.isSuper || me.role === 'ADMIN' || canUseMenu(me, 'access'))) {
    return res.status(403).json({ error: 'Admin role required' });
  }
  const target = operatorStore.getById(req.params.id);
  if (!target || target.partnerId !== me.partnerId) return res.status(404).json({ error: 'Not found' });
  const updated = operatorStore.update(target.id, {
    status: req.body?.status === 'suspended' ? 'suspended' : req.body?.status === 'active' ? 'active' : undefined,
    role: req.body?.role === 'STAFF' || req.body?.role === 'ADMIN' ? req.body.role : undefined,
    groupId: req.body?.groupId,
    menuOverride: req.body?.menuOverride,
    name: req.body?.name,
    password: req.body?.password,
  });
  writeAudit({
    actor: me,
    owner: me.partnerId || '',
    targetType: 'operator',
    targetId: target.id,
    action: req.body?.password ? 'password' : req.body?.groupId !== undefined ? 'group' : req.body?.menuOverride ? 'menus' : 'update',
    detail: `${target.email} group=${updated?.groupId || ''}`,
  });
  res.json(operatorStore.publicView(updated!));
});

router.get('/overview', requirePartnerPortal, (req, res) => {
  const partner = partnerStore.getById(req.auth!.partnerId!);
  if (!partner) return res.status(404).json({ error: 'Partner not found' });
  const policy = resolvePartnerPolicy(partner);
  const fees = feeSettings.getForPartner(partner.id);
  res.json({
    partner: {
      id: partner.id,
      name: partner.name,
      companyName: partner.companyName,
      status: partner.status,
      cardIssuePolicy: issuePolicyFromPartner(partner),
      allowVirtual: flagsFromIssuePolicy(issuePolicyFromPartner(partner)).allowVirtual,
      allowPlastic: flagsFromIssuePolicy(issuePolicyFromPartner(partner)).allowPlastic,
    },
    fees,
    feeSource: policy.source,
    feeTemplateName: policy.templateName,
    apiBase: '/api/partner/v1',
    credentials: partnerStore.publicCredentialView(partner),
    issuer: 'ICOCARD',
    note: 'Use ICOCARD MID / API Key / Secret. Do not use Wirex keys.',
  });
});

export default router;
