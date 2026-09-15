import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { config } from '../config.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';
import { wirexClientForUser } from '../clients/wirex/wirexClients.js';

const router = Router();
router.use(requireAuth);

function userCtx(user: { wirexUserId?: string; email?: string; walletAddress?: string }) {
  return {
    userId: user.wirexUserId,
    email: user.email,
    walletAddress: user.walletAddress,
  };
}

function isPlaceholderWirexId(id?: string | null) {
  if (!id) return true;
  return /^mock[-_]/i.test(id);
}

router.get('/verification-link', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (config.useMockWirex) {
      return res.json({
        url: null,
        message: 'Mock mode — KYC hosted link is not available. Set USE_MOCK_WIREX=false for sandbox KYC.',
      });
    }
    if (isPlaceholderWirexId(user.wirexUserId) || !user.walletAddress) {
      return res.status(409).json({
        url: null,
        error: 'Wirex user is not ready for KYC. Tap Continue on Home to finish registration first.',
        message: 'Wirex user is not ready for KYC. Tap Continue on Home to finish registration first.',
        needOnboard: true,
      });
    }
    const wx = wirexClientForUser(user);
    const url = await wx.getVerificationLink(userCtx(user));
    if (!url) {
      return res.status(502).json({
        url: null,
        error: 'Wirex returned an empty KYC link',
        message: 'Wirex returned an empty KYC link',
      });
    }
    if (user.onboardingStatus === 'registered') {
      store.updateOnboarding(user.id, { onboardingStatus: 'kyc', onboardingError: null });
    }
    res.json({ url });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message, url: null, message: (e as Error).message });
  }
});

router.get('/verification-token', async (req, res) => {
  try {
    if (config.useMockWirex) {
      return res.json({ token: 'mock-sumsub-sdk-token', mock: true });
    }
    const user = store.getUserById(req.auth!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const token = await wirexClient.getVerificationToken(userCtx(user));
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/sharing-token', async (req, res) => {
  try {
    const sharingToken = String(req.body?.sharing_token ?? '');
    if (!sharingToken) return res.status(400).json({ error: 'sharing_token required' });
    if (config.useMockWirex) {
      store.updateKyc(req.auth!.userId, { kycStatus: 'verified', kycLevel: 'SDD' });
      return res.json({ ok: true, mock: true });
    }
    const user = store.getUserById(req.auth!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const result = await wirexClient.setSharingToken(userCtx(user), sharingToken);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!config.useMockWirex && (user.wirexUserId || user.walletAddress) && !isPlaceholderWirexId(user.wirexUserId)) {
      try {
        const profile = (await wirexClient.getUser(userCtx(user))) as Record<string, unknown>;
        const caps = Array.isArray(profile.capabilities) ? profile.capabilities : [];
        const names = (caps as Array<{ name?: string; status?: string }>).map((c) => c.name ?? String(c));
        const verified =
          names.includes('VisaVirtualCard') || String(profile.verification_status).toLowerCase().includes('verif');
        store.updateKyc(user.id, {
          kycStatus: verified ? 'verified' : 'pending',
          capabilities: names.filter(Boolean) as string[],
        });
        if (verified && user.onboardingStatus && user.onboardingStatus !== 'ready') {
          store.updateOnboarding(user.id, { onboardingStatus: 'kyc', kycStatus: 'verified' });
        }
        return res.json({
          kycStatus: verified ? 'verified' : user.kycStatus ?? 'pending',
          profile,
          capabilities: names,
        });
      } catch {
        /* fall through */
      }
    }
    res.json({
      kycStatus: user.kycStatus ?? 'pending',
      kycLevel: user.kycLevel,
      capabilities: user.capabilities ?? [],
      mock: config.useMockWirex,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
