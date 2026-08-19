/**
 * Co-Branded Sandbox 통합 플로우
 *
 * 사용:
 *   cd backend && npx tsx src/scripts/test-flow.ts
 *
 * 환경:
 *   USE_MOCK_WIREX=true  → 내부 Mock (기본)
 *   USE_MOCK_WIREX=false + WALLET_ADDRESS=0x... → 실제 Sandbox BaaS
 *
 * 공식 순서:
 *   1. POST /api/v1/token
 *   2. (온체인) ZeroDev 월렛 배포 + Accounts 등록 — 이 스크립트는 주소만 받음
 *   3. POST /api/v2/user
 *   4. Helper mint (가상 잔액)
 *   5. POST /api/v2/cards/virtual
 *   6. Helper POST /card/auth-and-clearing
 */

import 'dotenv/config';
import { getUseMockWirex, getWirexBaaSConfig } from '../config.js';
import { mockWirex } from '../services/wirex/mockWirex.js';
import { wirexClient } from '../clients/wirex/WirexClient.js';
import { sandboxHelper } from '../clients/wirex/SandboxHelperClient.js';

async function runMock(): Promise<void> {
  console.log('[test-flow] MOCK 모드');
  const user = await mockWirex.createUser({ email: `sandbox+${Date.now()}@test.local` });
  console.log('  user', user.id, user.primaryWalletAddress);
  const card = await mockWirex.createVirtualCard(user.id, { limit: 5000, currency: 'USD' });
  console.log('  card', card.id, card.panLast4);
  await mockWirex.depositToCard(card.id, 50);
  const w = await mockWirex.getCardWallet(card.id);
  console.log('  card balance', w?.balance);
  console.log('[test-flow] MOCK 완료');
}

async function runLive(): Promise<void> {
  const wallet = process.env.WALLET_ADDRESS || process.env.WIREX_TEST_WALLET;
  const email = process.env.TEST_EMAIL || `sandbox+${Date.now()}@example.com`;
  const country = process.env.TEST_COUNTRY || 'GB';
  if (!wallet) {
    throw new Error('USE_MOCK_WIREX=false 이면 WALLET_ADDRESS (온체인 등록된 EOA) 가 필요합니다.');
  }
  const cfg = getWirexBaaSConfig();
  console.log('[test-flow] LIVE Sandbox', cfg.apiBase, 'chain', cfg.chainId);

  const token = await wirexClient.getAccessToken();
  console.log('  token ok', token.slice(0, 16) + '...');

  const ctx = { walletAddress: wallet, email };
  let userId: string;
  try {
    const created = await wirexClient.registerUser({ wallet_address: wallet, email, country });
    userId = created.id;
    console.log('  registered user', userId);
  } catch (e) {
    console.log('  register skip/fail:', (e as Error).message);
    const existing = await wirexClient.getUser(ctx);
    userId = String((existing as { user_id?: string; id?: string }).user_id ?? (existing as { id?: string }).id ?? '');
    console.log('  existing user', userId || existing);
  }

  try {
    const mint = await sandboxHelper.mintWusd(wallet, 50);
    console.log('  mint', mint);
  } catch (e) {
    console.log('  mint skip:', (e as Error).message);
  }

  const card = await wirexClient.issueVirtualCard(ctx, { card_name: 'Co-Brand Virtual', name_on_card: 'SANDBOX USER' });
  console.log('  issued card', card.id, card.status);

  try {
    const tx = await sandboxHelper.cardAuthAndClearing({ cardId: card.id, amount: 5, currency: 'USD' });
    console.log('  simulated purchase', tx);
  } catch (e) {
    console.log('  purchase skip:', (e as Error).message);
  }

  const walletBal = await wirexClient.getWallet(ctx);
  console.log('  unified balance', walletBal);
  console.log('[test-flow] LIVE 완료 userId=', userId);
}

async function main() {
  if (getUseMockWirex()) await runMock();
  else await runLive();
}

main().catch((e) => {
  console.error('[test-flow] failed', e);
  process.exit(1);
});
