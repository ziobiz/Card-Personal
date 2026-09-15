import { Router } from 'express';
import { createHash } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { mockWirex } from '../services/wirex/mockWirex.js';
import { wirexService } from '../services/wirex/wirexService.js';
import { config } from '../config.js';
import { webauthnService } from '../lib/webauthn.js';
import { issueWalletChallenge, verifyWalletBind } from '../lib/walletBind.js';
import { bridgeStore } from '../data/bridgeStore.js';
import { partnerStore } from '../data/partnerStore.js';
import { isWalletModeAllowed, resolveWalletModes, walletModeDeniedError, type WalletModeKey } from '../lib/walletPolicy.js';
import { manualsFor } from '../lib/manualCatalog.js';

function partnerForUser(user: { partnerId?: string }) {
  return user.partnerId ? partnerStore.getById(user.partnerId) : undefined;
}

function assertWalletMode(user: { partnerId?: string }, mode: WalletModeKey): string | null {
  return isWalletModeAllowed(partnerForUser(user), mode) ? null : walletModeDeniedError(mode);
}

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
    onboarding: {
      status: user.onboardingStatus || 'none',
      error: user.onboardingError || null,
      eoa: user.walletAddress || '',
      smartWallet: user.smartWalletAddress || '',
      walletMode: user.walletMode || 'embedded',
    },
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

router.get('/wallet/bridge', (req, res) => {
  const user = store.getUserById(req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    mode: user.walletMode || 'embedded',
    items: bridgeStore.list({ userId: user.id }),
  });
});

router.get('/onboarding', (req, res) => {
  const user = store.getUserById(req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    ok: true,
    ...publicProfile(user).onboarding,
    wirexUserId: user.wirexUserId || null,
    kycStatus: user.kycStatus || 'pending',
    walletMode: user.walletMode || 'embedded',
    allowedWalletModes: resolveWalletModes(partnerForUser(user)),
    walletPolicySource: partnerForUser(user)?.walletPolicySource === 'custom' ? 'custom' : 'follow_hq',
    mock: config.useMockWirex,
  });
});

router.get('/wallet/challenge', (req, res) => {
  res.json(issueWalletChallenge(req.auth!.userId));
});

router.post('/wallet/connect', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user0 = store.getUserById(userId);
    if (!user0) return res.status(404).json({ error: 'User not found' });
    const denied = assertWalletMode(user0, 'external_eoa');
    if (denied) return res.status(403).json({ error: denied });
    const address = String(req.body?.address || '').trim() as `0x${string}`;
    const signature = String(req.body?.signature || '').trim() as `0x${string}`;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address) || !signature.startsWith('0x')) {
      return res.status(400).json({ error: 'address and signature required' });
    }
    const checked = await verifyWalletBind({ userId, address, signature });
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    store.updateOnboarding(userId, {
      walletAddress: address,
      walletMode: 'external_eoa',
      eoaKeyEnc: null,
      onboardingStatus: 'wallet',
      onboardingError: null,
    });
    const { onboardingService } = await import('../services/onboardingService.js');
    const result = await onboardingService.run(userId, { issueCard: false, mint: false });
    res.json({ ...result, mode: 'external_eoa', address });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/wallet/embedded', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user0 = store.getUserById(userId);
    if (!user0) return res.status(404).json({ error: 'User not found' });
    const denied = assertWalletMode(user0, 'embedded');
    if (denied) return res.status(403).json({ error: denied });
    store.updateOnboarding(userId, { walletMode: 'embedded', onboardingStatus: 'none', onboardingError: null });
    const { onboardingService } = await import('../services/onboardingService.js');
    const result = await onboardingService.run(userId, { issueCard: false, mint: true });
    res.json({ ...result, mode: 'embedded' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/wallet/bridge/topup', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const denied = assertWalletMode(user, 'bridge');
    if (denied) return res.status(403).json({ error: denied });
    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || 'USD');
    if (!(amount > 0)) return res.status(400).json({ error: 'amount required' });
    store.updateOnboarding(user.id, { walletMode: 'bridge' });
    const entry = bridgeStore.add({
      partnerId: user.partnerId || 'direct',
      userId: user.id,
      direction: 'debit_request',
      amount,
      currency,
      status: 'pending',
      note: 'member_topup',
    });
    if (user.partnerId) {
      const partner = (await import('../data/partnerStore.js')).partnerStore.getById(user.partnerId);
      if (partner?.bridgeDebitUrl) {
        try {
          const r = await fetch(partner.bridgeDebitUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              email: user.email,
              amount,
              currency,
              request_id: entry.id,
            }),
          });
          if (!r.ok) {
            bridgeStore.update(entry.id, { status: 'failed', note: `partner HTTP ${r.status}` });
            return res.status(502).json({ error: 'Bridge partner rejected debit', id: entry.id });
          }
        } catch (e) {
          bridgeStore.update(entry.id, { status: 'failed', note: (e as Error).message });
          return res.status(502).json({ error: 'Bridge partner unreachable', id: entry.id });
        }
      }
    }
    if (user.walletAddress && !config.useMockWirex) {
      try {
        const { sandboxHelper } = await import('../clients/wirex/SandboxHelperClient.js');
        await sandboxHelper.mintWusd(user.walletAddress, amount);
      } catch {
        /* ledger still records */
      }
    }
    bridgeStore.update(entry.id, { status: 'posted' });
    res.json({ ok: true, entry: bridgeStore.list({ userId: user.id }).find((x) => x.id === entry.id) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** 온체인 지갑 → Wirex 유저 → KYC 링크 (공식 순서) */
router.post('/onboard', async (req, res) => {
  req.setTimeout(180000);
  res.setTimeout(180000);
  try {
    const issueCard = req.body?.issueCard !== false;
    const { onboardingService } = await import('../services/onboardingService.js');
    const result = await onboardingService.run(req.auth!.userId, { issueCard, mint: true });
    res.json(result);
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

router.get('/manuals', (_req, res) => {
  res.json({ items: manualsFor({ audience: 'customer' }), ready: false });
});

export default router;
