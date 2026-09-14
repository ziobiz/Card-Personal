/**
 * Wirex 공식 온보딩 오케스트레이션
 * 1. Embedded EOA
 * 2. Kernel AA 배포 + executor/policy + Accounts 등록
 * 3. POST /api/v2/user
 * 4. KYC verification-link
 * 5. (옵션) Sandbox mint + virtual card
 * https://docs.wirexapp.com/docs/user-onboarding
 */

import { config } from '../config.js';
import { store, type AppUser } from '../data/store.js';
import { brandStore } from '../data/brandStore.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';
import { createWirexSdk } from '../clients/wirex/wirexSdk.js';
import { sandboxHelper } from '../clients/wirex/SandboxHelperClient.js';
import {
  decryptPrivateKey,
  encryptPrivateKey,
  eoaAddressFromKey,
  generateEoaKey,
} from '../lib/embeddedWallet.js';

export type OnboardStep = { step: string; ok: boolean; detail?: unknown };

const running = new Set<string>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function publicOnboarding(user: AppUser) {
  return {
    status: user.onboardingStatus || 'none',
    error: user.onboardingError || null,
    eoa: user.walletAddress || '',
    smartWallet: user.smartWalletAddress || '',
    wirexUserId: user.wirexUserId || null,
    kycStatus: user.kycStatus || 'pending',
    mock: config.useMockWirex,
  };
}

async function ensureKey(user: AppUser): Promise<{ pk: `0x${string}`; eoa: `0x${string}` }> {
  if (user.eoaKeyEnc) {
    const pk = decryptPrivateKey(user.eoaKeyEnc);
    return { pk, eoa: eoaAddressFromKey(pk) };
  }
  const pk = generateEoaKey();
  const eoa = eoaAddressFromKey(pk);
  store.updateOnboarding(user.id, {
    eoaKeyEnc: encryptPrivateKey(pk),
    walletAddress: eoa,
    onboardingStatus: 'wallet',
    onboardingError: null,
  });
  return { pk, eoa };
}

async function deployOnchain(pk: `0x${string}`): Promise<{ smart: `0x${string}`; steps: OnboardStep[] }> {
  const steps: OnboardStep[] = [];
  const sdk = await createWirexSdk(pk);
  const smart = await sdk.crypto.wallet.getSmartWalletAddress();
  steps.push({ step: 'smartWalletAddress', ok: true, detail: smart });

  try {
    await sdk.crypto.onboarding.allInOneStepOnboarding();
    steps.push({ step: 'allInOneOnboarding', ok: true });
  } catch (e) {
    steps.push({ step: 'allInOneOnboarding', ok: false, detail: (e as Error).message });
    const policy = await sdk.crypto.accountAbstraction.isPolicyInstalled().catch(() => false);
    const exec = await sdk.crypto.accountAbstraction.isExecutorInstalled().catch(() => false);
    if (!policy || !exec) {
      await sdk.crypto.accountAbstraction.signInPolicyAndExecutor();
      steps.push({ step: 'signInPolicyAndExecutor', ok: true });
    } else {
      steps.push({ step: 'modulesAlreadyInstalled', ok: true });
    }
    const registered = await sdk.crypto.accountContract.isWalletInAccounts().catch(() => false);
    if (!registered) {
      await sdk.crypto.accountContract.registerInAccounts();
      steps.push({ step: 'registerInAccounts', ok: true });
    } else {
      steps.push({ step: 'alreadyInAccounts', ok: true });
    }
  }
  return { smart, steps };
}

async function registerApi(email: string, country: string, eoa: string): Promise<string> {
  let last = '';
  for (let i = 0; i < 4; i++) {
    try {
      const created = await wirexClient.registerUser({
        wallet_address: eoa,
        email,
        country: country || 'GB',
      });
      if (created.id) return created.id;
    } catch (e) {
      last = (e as Error).message;
      try {
        const existing = (await wirexClient.getUser({ walletAddress: eoa, email })) as {
          id?: string;
          user_id?: string;
        };
        const id = existing.id || existing.user_id;
        if (id) return id;
      } catch {
        /* retry */
      }
      await sleep(4000 * (i + 1));
    }
  }
  throw new Error(last || 'POST /api/v2/user failed');
}

export const onboardingService = {
  publicOnboarding,

  async run(userId: string, opts?: { issueCard?: boolean; mint?: boolean }): Promise<{
    ok: boolean;
    steps: OnboardStep[];
    kycUrl?: string | null;
    card?: unknown;
    onboarding: ReturnType<typeof publicOnboarding>;
  }> {
    const steps: OnboardStep[] = [];
    if (config.useMockWirex) {
      const user = store.getUserById(userId);
      if (!user) throw new Error('User not found');
      store.updateOnboarding(userId, { onboardingStatus: 'ready', kycStatus: 'verified', onboardingError: null });
      return {
        ok: true,
        steps: [{ step: 'mock', ok: true, detail: 'Mock mode — skip on-chain' }],
        kycUrl: null,
        onboarding: publicOnboarding(store.getUserById(userId)!),
      };
    }
    if (running.has(userId)) {
      throw new Error('Onboarding already in progress');
    }
    running.add(userId);
    try {
      const user0 = store.getUserById(userId);
      if (!user0) throw new Error('User not found');

      const { pk, eoa } = await ensureKey(user0);
      steps.push({ step: 'embeddedEoa', ok: true, detail: eoa });

      const afterKey = store.getUserById(userId)!;
      let smart = (afterKey.smartWalletAddress || '') as `0x${string}` | '';
      const needChain =
        !smart || ['none', 'wallet', 'error'].includes(afterKey.onboardingStatus || 'none');
      if (needChain) {
        const deployed = await deployOnchain(pk);
        smart = deployed.smart;
        steps.push(...deployed.steps);
        store.updateOnboarding(userId, {
          walletAddress: eoa,
          smartWalletAddress: smart,
          onboardingStatus: 'onchain',
          onboardingError: null,
        });
      } else {
        steps.push({ step: 'onchainReuse', ok: true, detail: smart });
      }

      let wirexUserId = store.getUserById(userId)!.wirexUserId;
      if (!wirexUserId) {
        wirexUserId = await registerApi(user0.email, user0.country || 'GB', eoa);
        steps.push({ step: 'registerUser', ok: true, detail: wirexUserId });
        store.updateOnboarding(userId, { wirexUserId, onboardingStatus: 'registered' });
      } else {
        steps.push({ step: 'registerUser', ok: true, detail: wirexUserId });
        if ((store.getUserById(userId)!.onboardingStatus || '') === 'onchain') {
          store.updateOnboarding(userId, { onboardingStatus: 'registered' });
        }
      }

      let kycUrl: string | null = null;
      try {
        kycUrl = await wirexClient.getVerificationLink({
          walletAddress: eoa,
          email: user0.email,
          userId: wirexUserId,
        });
        steps.push({ step: 'kycLink', ok: Boolean(kycUrl), detail: kycUrl });
        if (kycUrl) store.updateOnboarding(userId, { onboardingStatus: 'kyc' });
      } catch (e) {
        steps.push({ step: 'kycLink', ok: false, detail: (e as Error).message });
      }

      if (opts?.mint !== false) {
        try {
          const mint = await sandboxHelper.mintWusd(eoa, 20);
          steps.push({ step: 'mintWusd', ok: true, detail: mint });
        } catch (e) {
          steps.push({ step: 'mintWusd', ok: false, detail: (e as Error).message });
        }
      }

      let card: unknown;
      if (opts?.issueCard) {
        try {
          const brand = brandStore.get();
          const cardName = `${brand.cardBrandName || brand.productName} Virtual`.slice(0, 32);
          let last = '';
          for (let i = 0; i < 3; i++) {
            try {
              card = await wirexClient.issueVirtualCard(
                { walletAddress: eoa, email: user0.email, userId: wirexUserId },
                { card_name: cardName, name_on_card: (user0.displayName || 'CARD HOLDER').slice(0, 24) }
              );
              last = '';
              break;
            } catch (e) {
              last = (e as Error).message;
              await sleep(3000 * (i + 1));
            }
          }
          if (card) {
            steps.push({ step: 'issueVirtualCard', ok: true, detail: card });
            store.updateOnboarding(userId, { onboardingStatus: 'ready' });
          } else {
            steps.push({ step: 'issueVirtualCard', ok: false, detail: last });
          }
        } catch (e) {
          steps.push({ step: 'issueVirtualCard', ok: false, detail: (e as Error).message });
        }
      } else if (!kycUrl) {
        store.updateOnboarding(userId, { onboardingStatus: 'registered' });
      }

      const latest = store.getUserById(userId)!;
      const registered = steps.some((s) => s.step === 'registerUser' && s.ok);
      const cardOk = !opts?.issueCard || steps.some((s) => s.step === 'issueVirtualCard' && s.ok);
      return { ok: registered && cardOk, steps, kycUrl, card, onboarding: publicOnboarding(latest) };
    } catch (e) {
      const msg = (e as Error).message;
      store.updateOnboarding(userId, { onboardingStatus: 'error', onboardingError: msg });
      steps.push({ step: 'failed', ok: false, detail: msg });
      const latest = store.getUserById(userId);
      return {
        ok: false,
        steps,
        onboarding: latest ? publicOnboarding(latest) : { status: 'error', error: msg, eoa: '', smartWallet: '', wirexUserId: null, kycStatus: 'pending', mock: false },
      };
    } finally {
      running.delete(userId);
    }
  },
};
