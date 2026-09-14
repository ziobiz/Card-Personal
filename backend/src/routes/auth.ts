import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { config } from '../config.js';
import { store } from '../data/store.js';
import { partnerStore } from '../data/partnerStore.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { generateOtpSecret, otpAuthUrl, verifyTotp } from '../lib/totp.js';
import { getSecuritySettings, maskEmail } from '../lib/otpPolicy.js';
import { webauthnService } from '../lib/webauthn.js';

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

router.post('/register', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const { wallet_address, country } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    store.loadUsers();
    if (store.getUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const tenant = tenantFromRequest(req);
    if (tenant.slug && !tenant.partner) {
      return res.status(400).json({ error: 'tenant_not_found' });
    }

    const walletAddress = typeof wallet_address === 'string' ? wallet_address.trim() : undefined;
    const residence = typeof country === 'string' ? country : 'GB';
    const id = uuidv4();

    let wirexUserId: string | undefined;
    let storedWallet = walletAddress;
    if (config.useMockWirex) {
      const wirexUser = await wirexService.createUser({
        email,
        wallet_address: walletAddress,
        country: residence,
      });
      wirexUserId = wirexUser.id;
      storedWallet = walletAddress ?? wirexUser.primaryWalletAddress;
    }

    const appUser = {
      id,
      email,
      passwordHash: hashPassword(password),
      wirexUserId,
      walletAddress: storedWallet,
      country: residence,
      source: tenant.partner ? ('partner' as const) : ('direct' as const),
      partnerId: tenant.partner?.id,
      otpSecret: undefined as string | undefined,
      otpEnabled: false,
      onboardingStatus: (config.useMockWirex ? 'ready' : 'none') as 'ready' | 'none',
      createdAt: new Date().toISOString(),
    };
    store.addUser(appUser);

    if (!config.useMockWirex) {
      const { onboardingService } = await import('../services/onboardingService.js');
      void onboardingService.run(id).catch((err) => {
        console.warn('[onboard] register', (err as Error).message);
      });
    }

    const sec = getSecuritySettings();
    if (sec.otpRequiredMember) {
      return res.json({
        mustSetupOtp: true,
        enrollToken: signEnroll(id),
        maskedEmail: maskEmail(email),
        user: { id, email, wirexUserId: wirexUserId, walletAddress: appUser.walletAddress },
      });
    }

    const token = signMember(id, email);
    res.json({ token, user: { id, email, wirexUserId, walletAddress: appUser.walletAddress } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/login', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  store.loadUsers();
  const user = store.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials',
      hint: '회원가입을 먼저 해주세요. / Please register first. → http://localhost:3000/register',
    });
  }
  if (user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials', hint: '비밀번호를 확인해주세요.' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Account suspended' });
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
