import { store } from '../data/store.js';
import { classifyActivity, ledgerStore, type IsoFields } from '../data/ledgerStore.js';
import { threeDsStore } from '../data/threeDsStore.js';
import { billingService } from './billingService.js';

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function isoFromActivity(p: Record<string, unknown>, kind: string): IsoFields {
  const nested = asObj(p.source_amount);
  const settle = asObj(p.destination_amount);
  const amount = Number(nested.amount ?? p.amount ?? 0);
  const currency = String(nested.currency ?? p.currency ?? 'USD');
  const settlementAmount = Number(settle.amount ?? p.settlement_amount ?? amount);
  const settlementCurrency = String(settle.token_symbol ?? p.settlement_currency ?? currency);
  const ops = Array.isArray(p.operations) ? p.operations : [];
  const hash = String((asObj(ops[0]).hash as string) ?? '');
  const mti = kind === 'authorization' ? '0100' : kind === 'refund' ? '0420' : kind === 'decline' ? '0110' : '0200';
  return {
    mti,
    processingCode: '000000',
    amount,
    settlementAmount,
    currency,
    settlementCurrency,
    rrn: String(p.id ?? p.reference ?? hash.slice(0, 12) ?? ''),
    authCode: String(p.auth_code ?? '').slice(0, 6) || undefined,
    responseCode: kind === 'decline' ? '05' : '00',
    cardAcceptor: String(asObj(asObj(p.destination).merchant).name ?? p.merchant ?? ''),
    merchantCountry: String(p.merchant_country ?? ''),
    panLast4: String(asObj(asObj(p.source).card).pan_last4 ?? ''),
  };
}

export async function ingestWebhook(path: string, payload: unknown): Promise<void> {
  const p = asObj(payload);
  const nested = asObj(p.data);
  const merged = { ...nested, ...p };
  const userHint = String(merged.user_id ?? merged.userId ?? merged.user_address ?? '');
  const mapped = userHint ? store.getUserByWirexUserId(userHint) : undefined;
  const user = mapped ?? (userHint.startsWith('0x') ? undefined : store.getUserById(userHint));

  if (path.endsWith('/activities')) {
    const kind = classifyActivity(merged);
    const cardId = String(asObj(asObj(merged.source).card).id ?? merged.card_id ?? merged.cardId ?? '');
    const ops = Array.isArray(merged.operations) ? merged.operations : [];
    ledgerStore.add({
      kind,
      activityId: String(merged.id ?? ''),
      cardId: cardId || undefined,
      userId: user?.id,
      wirexUserId: user?.wirexUserId ?? userHint,
      direction: String(merged.direction ?? ''),
      status: String(merged.status ?? ''),
      onChainHash: String(asObj(ops[0]).hash ?? '') || undefined,
      iso: isoFromActivity(merged, kind),
      payload: merged,
    });
    if (cardId && Number(asObj(merged.source_amount).amount ?? merged.amount ?? 0) > 0) {
      const status = kind === 'decline' ? 'failed' : 'success';
      await billingService.recordCardUsage(
        cardId,
        user?.id ?? '',
        user?.wirexUserId ?? userHint,
        Number(asObj(merged.source_amount).amount ?? merged.amount ?? 0),
        status
      ).catch(() => undefined);
    }
  }

  if (path.endsWith('/cards')) {
    ledgerStore.add({
      kind: 'card_status',
      cardId: String(merged.id ?? merged.card_id ?? ''),
      userId: user?.id,
      status: String(merged.status ?? ''),
      iso: {
        mti: '0000',
        processingCode: '000000',
        amount: 0,
        settlementAmount: 0,
        currency: 'USD',
        settlementCurrency: 'USD',
        rrn: String(merged.id ?? ''),
        responseCode: '00',
      },
      payload: merged,
    });
  }

  if (path.endsWith('/user') || path.endsWith('/users')) {
    const statusRaw = String(merged.verification_status ?? merged.status ?? merged.kyc_status ?? '').toLowerCase();
    const verified = statusRaw.includes('verif') || statusRaw === 'active' || statusRaw === 'approved';
    if (user) {
      store.updateKyc(user.id, {
        kycStatus: verified ? 'verified' : statusRaw.includes('reject') ? 'rejected' : 'pending',
        kycLevel: String(merged.level ?? merged.kyc_level ?? ''),
        capabilities: Array.isArray(merged.capabilities)
          ? (merged.capabilities as Array<{ name?: string }>).map((c) => c.name ?? String(c))
          : undefined,
      });
    }
    ledgerStore.add({
      kind: 'kyc',
      userId: user?.id,
      status: statusRaw,
      iso: {
        mti: '0000',
        processingCode: '000000',
        amount: 0,
        settlementAmount: 0,
        currency: 'USD',
        settlementCurrency: 'USD',
        rrn: String(merged.id ?? user?.id ?? ''),
        responseCode: verified ? '00' : '05',
      },
      payload: merged,
    });
  }

  if (path.endsWith('/3ds')) {
    const transactionId = String(merged.transaction_id ?? merged.transactionId ?? merged.id ?? '');
    if (transactionId) {
      threeDsStore.upsert({
        transactionId,
        userId: user?.id,
        cardId: String(merged.card_id ?? merged.cardId ?? ''),
        amount: Number(asObj(merged.amount).amount ?? merged.amount ?? 0) || undefined,
        currency: String(asObj(merged.amount).currency ?? merged.currency ?? 'USD'),
        merchant: String(merged.merchant ?? merged.merchant_name ?? ''),
        status: 'pending',
        payload: merged,
        receivedAt: new Date().toISOString(),
      });
    }
  }
}
