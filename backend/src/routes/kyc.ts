import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { config } from '../config.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';
import { wirexService } from '../services/wirex/wirexService.js';

const router = Router();
router.use(requireAuth);

function ctx(userId: string) {
  const user = store.getUserById(userId);
  return {
    userId: user?.wirexUserId,
    email: user?.email,
    walletAddress: user?.walletAddress,
  };
}

router.get('/verification-link', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const url = await wirexService.getVerificationLink(user.wirexUserId, user.email);
    if (!url) {
      return res.json({ url: null, message: 'KYC verification is not configured. Using mock mode.' });
    }
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/verification-token', async (req, res) => {
  try {
    if (config.useMockWirex) {
      return res.json({ token: 'mock-sumsub-sdk-token', mock: true });
    }
    const token = await wirexClient.getVerificationToken(ctx(req.auth!.userId));
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
    const result = await wirexClient.setSharingToken(ctx(req.auth!.userId), sharingToken);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const user = store.getUserById(req.auth!.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!config.useMockWirex && (user.wirexUserId || user.walletAddress)) {
      try {
        const profile = (await wirexClient.getUser(ctx(user.id))) as Record<string, unknown>;
        const caps = Array.isArray(profile.capabilities) ? profile.capabilities : [];
        const names = (caps as Array<{ name?: string; status?: string }>).map((c) => c.name ?? String(c));
        const verified = names.includes('VisaVirtualCard') || String(profile.verification_status).toLowerCase().includes('verif');
        store.updateKyc(user.id, {
          kycStatus: verified ? 'verified' : 'pending',
          capabilities: names.filter(Boolean) as string[],
        });
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
