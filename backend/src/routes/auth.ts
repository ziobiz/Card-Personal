import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { config } from '../config.js';
import { store } from '../data/store.js';
import { partnerStore } from '../data/partnerStore.js';
import { getMemberRegistrationMode } from '../data/settingsStore.js';
import { generateOtpSecret, otpAuthUrl, verifyTotp } from '../lib/totp.js';
import { getSecuritySettings, maskEmail } from '../lib/otpPolicy.js';
import { webauthnService } from '../lib/webauthn.js';
import { requireTurnstile } from '../lib/turnstile.js';
import { consumeEmailCode, isEmailVerified, issueEmailCode } from '../lib/emailVerify.js';

const router = Router();

function hashPassword(password: string): string {
  return createHash('sha256').update(password + config.jwtSecret).digest('hex');
}

function signMember(userId: string, email: string, extra: Record<string, unknown> = {}) {
  return jwt.sign({ userId, email, ...extra }, config.jwtSecret, { expiresIn: '7d' });
}

function signEnroll(userId: string) {
  return jwt.sign({ userId, purpose: 'otp_enroll' }, config.jwtSecret, { expiresIn: '15m' });
}

function verifyEnroll(token: string): string | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId?: string; purpose?: string };
    if (decoded.purpose !== 'otp_enroll' || !decoded.userId) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

function tenantFromRequest(req: { headers: { [k: string]: string | string[] | undefined }; body?: unknown }) {
  const body = req.body && typeof req.body === 'object' ? (req.body as { slug?: unknown }) : {};
  const raw = req.headers['x-ico-tenant-slug'];
  const slug = String((Array.isArray(raw) ? raw[0] : raw) || body.slug || '').trim();
  if (!slug) return { slug: '', partner: undefined };
  const partner = partnerStore.getBySlug(slug);
  return { slug, partner };
}

router.get('/registration-policy', (_req, res) => {
  const mode = getMemberRegistrationMode();
  res.json({
    mode,
    needsApproval: mode === 'approval',
  });
});

function readBearerUser(req: { headers: { authorization?: string } }): { userId: string; otpPending?: boolean } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), config.jwtSecret) as { userId?: string; otpPending?: boolean };
    if (!decoded.userId) return null;
    return { userId: decoded.userId, otpPending: decoded.otpPending };
  } catch {
    return null;
  }
}

function finishSignupAccess(user: { id: string; email: string; status?: string }) {
  if (user.status === 'pending') {
    return {
      ok: true,
      needsApproval: true,
      user: { id: user.id, email: user.email, status: user.status },
    };
  }
  const sec = getSecuritySettings();
  if (sec.otpRequiredMember) {
    return {
      ok: true,
      needsApproval: false,
      mustSetupOtp: true,
      enrollToken: signEnroll(user.id),
      maskedEmail: maskEmail(user.email),
      user: { id: user.id, email: user.email, status: user.status },
    };
  }
  return {
    ok: true,
    needsApproval: false,
    token: signMember(user.id, user.email),
    user: { id: user.id, email: user.email, status: user.status },
  };
}

router.post('/register', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim().slice(0, 80) : '';
    const country = typeof req.body.country === 'string' ? req.body.country.trim().toUpperCase().slice(0, 8) : 'KR';
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required', code: 'missing_fields' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email', code: 'missing_fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'weak_password' });
    }
    const tenant = tenantFromRequest(req);
    if (tenant.slug && !tenant.partner) {
      return res.status(400).json({ error: 'tenant_not_found', code: 'tenant_not_found' });
    }

    const existing = store.getUserByEmail(email);
    if (existing) {
      if (isEmailVerified(existing) || existing.passwordHash === '[partner]') {
        return res.status(409).json({ error: 'Email already registered', code: 'email_taken' });
      }
      existing.passwordHash = hashPassword(password);
      if (displayName) existing.displayName = displayName;
      existing.country = country || existing.country || 'KR';
      store.save();
      const sent = await issueEmailCode(existing, 'register');
      if (!sent.ok) {
        return res.status(429).json({ error: 'Please wait before resending', code: 'email_code_wait' });
      }
      return res.status(200).json({
        ok: true,
        needsEmailVerify: true,
        maskedEmail: maskEmail(existing.email),
        user: { id: existing.id, email: existing.email, status: existing.status },
      });
    }

    const mode = getMemberRegistrationMode();
    const status = mode === 'approval' ? 'pending' : 'active';
    const id = uuidv4();

    store.addUser({
      id,
      email,
      passwordHash: hashPassword(password),
      displayName: displayName || undefined,
      country: country || 'KR',
      source: tenant.partner ? 'partner' : 'direct',
      partnerId: tenant.partner?.id,
      otpSecret: undefined,
      otpEnabled: false,
      emailVerified: false,
      status,
      kycStatus: 'pending',
      onboardingStatus: 'none',
      createdAt: new Date().toISOString(),
    });

    const created = store.getUserById(id);
    if (created) await issueEmailCode(created, 'register', { force: true });

    return res.status(201).json({
      ok: true,
      needsEmailVerify: true,
      maskedEmail: maskEmail(email),
      user: { id, email, status },
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message, code: 'register_failed' });
  }
});

router.post('/verify-email', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (!email || !code) return res.status(400).json({ error: 'Email and code required', code: 'missing_fields' });
  store.loadUsers();
  const user = store.getUserByEmail(email);
  if (!user) return res.status(400).json({ error: 'Invalid code', code: 'email_code_invalid' });
  const result = consumeEmailCode(user, 'register', code);
  if (result !== 'ok') {
    const map: Record<string, string> = {
      expired: 'email_code_expired',
      mismatch: 'email_code_invalid',
      locked: 'email_code_locked',
      missing: 'email_code_invalid',
    };
    return res.status(400).json({ error: 'Invalid code', code: map[result] || 'email_code_invalid' });
  }
  res.json(finishSignupAccess(user));
});

router.post('/resend-email-code', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const purpose = req.body?.purpose === 'reset' || req.body?.purpose === 'change_password' ? req.body.purpose : 'register';
  if (!email) return res.status(400).json({ error: 'Email required', code: 'missing_fields' });
  store.loadUsers();
  const user = store.getUserByEmail(email);
  if (!user || user.passwordHash === '[partner]') {
    return res.json({ ok: true });
  }
  if (purpose === 'register' && isEmailVerified(user)) {
    return res.status(400).json({ error: 'Already verified', code: 'email_taken' });
  }
  const sent = await issueEmailCode(user, purpose);
  if (!sent.ok) return res.status(429).json({ error: 'Please wait before resending', code: 'email_code_wait' });
  res.json({ ok: true, maskedEmail: maskEmail(user.email) });
});

router.post('/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email required', code: 'missing_fields' });
  store.loadUsers();
  const user = store.getUserByEmail(email);
  if (user && user.passwordHash !== '[partner]') {
    const sent = await issueEmailCode(user, 'reset');
    if (!sent.ok) return res.status(429).json({ error: 'Please wait before resending', code: 'email_code_wait' });
  }
  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !code || !password) {
    return res.status(400).json({ error: 'Email, code and password required', code: 'missing_fields' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password too short', code: 'weak_password' });
  store.loadUsers();
  const user = store.getUserByEmail(email);
  if (!user || user.passwordHash === '[partner]') {
    return res.status(400).json({ error: 'Invalid code', code: 'email_code_invalid' });
  }
  const result = consumeEmailCode(user, 'reset', code);
  if (result !== 'ok') {
    return res.status(400).json({ error: 'Invalid code', code: result === 'expired' ? 'email_code_expired' : result === 'locked' ? 'email_code_locked' : 'email_code_invalid' });
  }
  user.emailVerified = true;
  store.updatePassword(user.id, hashPassword(password));
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  store.loadUsers();
  const user = store.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({
      error: 'Not registered',
      code: 'not_registered',
    });
  }
  if (user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials', code: 'bad_password' });
  }
  if (!isEmailVerified(user)) {
    const sent = await issueEmailCode(user, 'register');
    return res.status(403).json({
      error: 'Email not verified',
      code: 'email_unverified',
      maskedEmail: maskEmail(user.email),
      canResend: sent.ok,
    });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Account pending approval', code: 'pending_approval' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'Registration rejected', code: 'account_rejected' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Account suspended', code: 'account_suspended' });
  }

  const tenant = tenantFromRequest(req);
  if (tenant.slug && !tenant.partner) {
    return res.status(400).json({ error: 'tenant_not_found' });
  }
  if (tenant.partner) {
    if (user.partnerId && user.partnerId !== tenant.partner.id) {
      return res.status(403).json({ error: 'tenant_mismatch' });
    }
    if (!user.partnerId) store.setPartnerId(user.id, tenant.partner.id);
  } else if (user.partnerId) {
    return res.status(403).json({ error: 'tenant_mismatch' });
  }

  const sec = getSecuritySettings();
  if (sec.otpRequiredMember) {
    if (!user.otpEnabled || !user.otpSecret) {
      return res.json({
        mustSetupOtp: true,
        enrollToken: signEnroll(user.id),
        maskedEmail: maskEmail(user.email),
        user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId },
      });
    }
    const token = signMember(user.id, user.email, { otpPending: true });
    return res.json({
      token,
      otpRequired: true,
      otpMethod: 'totp',
      biometricAvailable: webauthnService.hasCredentials(user),
      maskedEmail: maskEmail(user.email),
      user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId },
      mustChangePassword: false,
    });
  }

  const token = signMember(user.id, user.email);
  res.json({
    token,
    user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId },
    otpRequired: false,
    mustChangePassword: false,
  });
});

router.post('/otp/setup', (req, res) => {
  const enrollToken = String(req.body?.enrollToken || '');
  const userId = verifyEnroll(enrollToken);
  if (!userId) return res.status(401).json({ error: 'Invalid enroll session' });
  store.loadUsers();
  const user = store.getUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const secret = generateOtpSecret();
  store.updateOtp(user.id, { otpSecret: secret, otpEnabled: false });
  res.json({
    secret,
    otpauthUrl: otpAuthUrl(user.email, secret),
    enrollToken,
    maskedEmail: maskEmail(user.email),
  });
});

router.post('/otp/activate', (req, res) => {
  const enrollToken = String(req.body?.enrollToken || '');
  const code = String(req.body?.code || '');
  const userId = verifyEnroll(enrollToken);
  if (!userId) return res.status(401).json({ error: 'Invalid enroll session' });
  store.loadUsers();
  const user = store.getUserById(userId);
  if (!user?.otpSecret) return res.status(400).json({ error: 'OTP not provisioned' });
  if (!verifyTotp(user.otpSecret, code)) {
    return res.status(401).json({ error: 'Invalid OTP' });
  }
  store.updateOtp(user.id, { otpEnabled: true });
  const token = signMember(user.id, user.email);
  res.json({
    token,
    user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId },
    offerBiometric: true,
  });
});

router.post('/otp/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(auth.slice(7), config.jwtSecret) as {
      userId?: string;
      email?: string;
      otpPending?: boolean;
    };
    if (!decoded.userId) return res.status(401).json({ error: 'Unauthorized' });
    store.loadUsers();
    const user = store.getUserById(decoded.userId);
    if (!user?.otpSecret) return res.status(400).json({ error: 'OTP not provisioned' });
    const sec = getSecuritySettings();
    if (!sec.otpRequiredMember) {
      const token = signMember(user.id, user.email);
      return res.json({ token, otpRequired: false, offerBiometric: !webauthnService.hasCredentials(user) });
    }
    if (!verifyTotp(user.otpSecret, String(req.body?.code || ''))) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }
    const token = signMember(user.id, user.email);
    res.json({
      token,
      user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId },
      offerBiometric: !webauthnService.hasCredentials(user),
    });
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

/** Mobile biometric (WebAuthn platform) — register after successful OTP */
router.post('/webauthn/register/options', async (req, res) => {
  const sess = readBearerUser(req);
  if (!sess || sess.otpPending) return res.status(401).json({ error: 'Unauthorized' });
  store.loadUsers();
  const user = store.getUserById(sess.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    const options = await webauthnService.registrationOptions(user);
    res.json(options);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.post('/webauthn/register/verify', async (req, res) => {
  const sess = readBearerUser(req);
  if (!sess || sess.otpPending) return res.status(401).json({ error: 'Unauthorized' });
  store.loadUsers();
  const user = store.getUserById(sess.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    await webauthnService.verifyRegistration(user, req.body);
    res.json({ ok: true, biometricEnabled: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** Mobile biometric login while otpPending */
router.post('/webauthn/login/options', async (req, res) => {
  const sess = readBearerUser(req);
  if (!sess?.otpPending) return res.status(401).json({ error: 'OTP session required' });
  store.loadUsers();
  const user = store.getUserById(sess.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    const options = await webauthnService.authenticationOptions(user);
    res.json(options);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.post('/webauthn/login/verify', async (req, res) => {
  const sess = readBearerUser(req);
  if (!sess?.otpPending) return res.status(401).json({ error: 'OTP session required' });
  store.loadUsers();
  const user = store.getUserById(sess.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    await webauthnService.verifyAuthentication(user, req.body);
    const token = signMember(user.id, user.email);
    res.json({ token, user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId } });
  } catch (e) {
    res.status(401).json({ error: (e as Error).message });
  }
});

export default router;
