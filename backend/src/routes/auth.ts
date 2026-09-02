import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { config } from '../config.js';
import { store } from '../data/store.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { generateOtpSecret, verifyTotp } from '../lib/totp.js';

const router = Router();

function hashPassword(password: string): string {
  return createHash('sha256').update(password + config.jwtSecret).digest('hex');
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

    const walletAddress = typeof wallet_address === 'string' ? wallet_address.trim() : undefined;
    const residence = typeof country === 'string' ? country : 'GB';
    const wirexUser = await wirexService.createUser({
      email,
      wallet_address: walletAddress,
      country: residence,
    });
    const id = uuidv4();
    const appUser = {
      id,
      email,
      passwordHash: hashPassword(password),
      wirexUserId: wirexUser.id,
      walletAddress: walletAddress ?? wirexUser.primaryWalletAddress,
      country: residence,
      source: 'direct' as const,
      otpSecret: generateOtpSecret(),
      otpEnabled: true,
      createdAt: new Date().toISOString(),
    };
    store.addUser(appUser);

    const token = jwt.sign({ userId: id, email }, config.jwtSecret, { expiresIn: '7d' });
    res.json({ token, user: { id, email, wirexUserId: wirexUser.id, walletAddress: appUser.walletAddress } });
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
  console.log('[LOGIN] email:', JSON.stringify(email), 'user found:', !!user, 'store size:', store.users.size);
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
  const otpRequired = config.otpRequiredMember;
  const token = jwt.sign(
    { userId: user.id, email: user.email, ...(otpRequired ? { otpPending: true } : {}) },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId },
    otpRequired,
    mustChangePassword: false,
  });
});

router.post('/otp/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(auth.slice(7), config.jwtSecret) as { userId?: string; email?: string };
    if (!decoded.userId) return res.status(401).json({ error: 'Unauthorized' });
    store.loadUsers();
    const user = store.getUserById(decoded.userId);
    if (!user?.otpSecret) return res.status(400).json({ error: 'OTP not provisioned' });
    if (!config.otpRequiredMember) {
      const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
      return res.json({ token, otpRequired: false });
    }
    if (!verifyTotp(user.otpSecret, String(req.body?.code || ''))) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId } });
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export default router;
