import { Router } from 'express';
import { createHash } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { mockWirex } from '../services/wirex/mockWirex.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { config } from '../config.js';
import { webauthnService } from '../lib/webauthn.js';

const router = Router();
router.use(requireAuth);

function hashPassword(password: string): string {
  return createHash('sha256').update(password + config.jwtSecret).digest('hex');
}

function publicProfile(user: NonNullable<ReturnType<typeof store.getUserById>>, extra: Record<string, unknown> = {}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || '',
    phone: user.phone || '',
    country: user.country || '',
    wirexUserId: user.wirexUserId || null,
    walletAddress: user.walletAddress || '',
    kycStatus: user.kycStatus || 'pending',
    source: user.source || 'direct',
    status: user.status || 'active',
    createdAt: user.createdAt,
    otpEnabled: Boolean(user.otpEnabled && user.otpSecret),
    biometricEnabled: webauthnService.hasCredentials(user),
    biometricCount: user.webauthnCredentials?.length || 0,
    ...extra,
  };
}

router.get('/', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let wirexStatus: string | undefined;
    if (user.wirexUserId) {
      try {
        const wirexUser = await mockWirex.getUser(user.wirexUserId);
        wirexStatus = wirexUser?.status;
      } catch {
        /* ignore */
      }
    }

    res.json(
      publicProfile(user, {
        status: wirexStatus ?? user.status ?? 'pending',
        mock: config.useMockWirex,
      })
    );
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 개인정보(표시명·전화·국가) 수정 — 로그인 이메일(아이디)은 변경 불가 */
router.put('/profile', (req, res) => {
  try {
    const userId = req.auth!.userId;
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName : undefined;
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : undefined;
    const country = typeof req.body?.country === 'string' ? req.body.country : undefined;
    store.loadUsers();
    const updated = store.updateProfile(userId, { displayName, phone, country });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, user: publicProfile(updated) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 비밀번호 변경 — 현재 비밀번호 확인 후 새 비밀번호 저장 */
router.put('/password', (req, res) => {
  try {
    const userId = req.auth!.userId;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    store.loadUsers();
    const user = store.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.passwordHash === '[partner]') {
      return res.status(403).json({ error: 'Password change not available for this account' });
    }
    if (user.passwordHash !== hashPassword(currentPassword)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    store.updatePassword(userId, hashPassword(newPassword));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 등록된 생체 인증 제거 */
router.delete('/biometric', (req, res) => {
  try {
    const userId = req.auth!.userId;
    store.loadUsers();
    const updated = store.setWebauthnCredentials(userId, []);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, biometricEnabled: false });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 온체인 등록된 EOA를 연결 — Live Sandbox 필수 */
router.put('/wallet', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const wallet_address = String(req.body?.wallet_address ?? '').trim();
    const country = String(req.body?.country ?? user.country ?? 'GB');
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({ error: 'Valid wallet_address (0x + 40 hex) required' });
    }
    if (!config.useMockWirex) {
      const registered = await wirexService.createUser({
        email: user.email,
        wallet_address,
        country,
      });
      store.updateWirexUserId(userId, registered.id || user.wirexUserId || '', {
        walletAddress: wallet_address,
        country,
      });
    } else {
      store.updateWirexUserId(userId, user.wirexUserId || user.id, { walletAddress: wallet_address, country });
    }
    const updated = store.getUserById(userId);
    res.json(updated ? publicProfile(updated) : { ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
