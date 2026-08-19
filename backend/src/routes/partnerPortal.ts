import { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { operatorStore } from '../data/operatorStore.js';
import { partnerStore, issuePolicyFromPartner, flagsFromIssuePolicy } from '../data/partnerStore.js';
import { feeSettings } from '../data/feeSettings.js';
import { resolvePartnerPolicy } from '../data/feePolicyTemplateStore.js';
import { otpAuthUrl, verifyTotp } from '../lib/totp.js';

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

router.post('/login', (req, res) => {
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
  const otpRequired = config.otpRequiredOrg && Boolean(op.otpEnabled);
  const token = signPartner(op, otpRequired ? { otpPending: true } : {});
  res.json({
    token,
    otpRequired,
    otpEnabled: Boolean(op.otpEnabled),
    mustChangePassword: Boolean(op.mustChangePassword),
    operator: { id: op.id, email: op.email, name: op.name, role: op.role },
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
  const op = operatorStore.getById(decoded.operatorId);
  if (!op?.otpSecret) return res.status(404).json({ error: 'OTP not provisioned' });
  res.json({
    otpEnabled: Boolean(op.otpEnabled),
    otpRequired: config.otpRequiredOrg,
    otpauthUrl: otpAuthUrl(op.email, op.otpSecret),
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
  });
});

export default router;
