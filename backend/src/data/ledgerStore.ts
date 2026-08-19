/**
 * ISO 규격에 맞춘 카드/정산 원장
 * 웹훅 activities + Helper auth-and-clearing 을 조정(Reconciliation) 데이터로 보관
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export type LedgerEventKind =
  | 'authorization'
  | 'settlement'
  | 'decline'
  | 'refund'
  | 'card_status'
  | 'kyc'
  | 'other';

export interface IsoFields {
  /** Message Type Indicator — 0100 auth, 0200 financial, 0420 reversal */
  mti: string;
  processingCode: string;
  amount: number;
  settlementAmount: number;
  currency: string;
  settlementCurrency: string;
  rrn: string;
  authCode?: string;
  responseCode: string;
  cardAcceptor?: string;
  merchantCountry?: string;
  panLast4?: string;
}

export interface LedgerEntry {
  id: string;
  kind: LedgerEventKind;
  activityId?: string;
  cardId?: string;
  userId?: string;
  partnerId?: string;
  wirexUserId?: string;
  direction?: string;
  status: string;
  onChainHash?: string;
  iso: IsoFields;
  payload?: unknown;
  createdAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'iso_ledger.json');

function load(): LedgerEntry[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).entries ?? [];
  } catch {
    return [];
  }
}

function save(entries: LedgerEntry[]): void {
  try {
    writeFileSync(FILE, JSON.stringify({ entries: entries.slice(-5000) }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save iso ledger:', e);
  }
}

const entries: LedgerEntry[] = load();

function nextId(): string {
  return 'iso_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function classifyActivity(payload: Record<string, unknown>): LedgerEventKind {
  const status = String(payload.status ?? '').toLowerCase();
  const direction = String(payload.direction ?? '').toLowerCase();
  const steps = Array.isArray(payload.activity_steps) ? payload.activity_steps : [];
  const hasReversal = steps.some((s) => String((s as { name?: string }).name ?? '').toLowerCase().includes('reversal'));
  if (hasReversal || (direction === 'inbound' && String(payload.type).toLowerCase().includes('card'))) return 'refund';
  if (status === 'pending') return 'authorization';
  if (status === 'failed' || status === 'declined' || status === 'rejected') return 'decline';
  if (status === 'completed') return 'settlement';
  return 'other';
}

export const ledgerStore = {
  add(partial: Omit<LedgerEntry, 'id' | 'createdAt'>): LedgerEntry {
    const full: LedgerEntry = { ...partial, id: nextId(), createdAt: new Date().toISOString() };
    entries.push(full);
    save(entries);
    return full;
  },

  list(filters?: { from?: string; to?: string; kind?: LedgerEventKind; cardId?: string; userId?: string; partnerId?: string }): LedgerEntry[] {
    let list = [...entries];
    if (filters?.kind) list = list.filter((e) => e.kind === filters.kind);
    if (filters?.cardId) list = list.filter((e) => e.cardId === filters.cardId);
    if (filters?.userId) list = list.filter((e) => e.userId === filters.userId);
    if (filters?.partnerId) list = list.filter((e) => e.partnerId === filters.partnerId);
    if (filters?.from) list = list.filter((e) => e.createdAt >= filters.from!);
    if (filters?.to) list = list.filter((e) => e.createdAt <= filters.to!);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  summary(filters?: { from?: string; to?: string; partnerId?: string }) {
    const list = this.list(filters);
    const byKind: Record<string, { count: number; amount: number; settlement: number }> = {};
    for (const e of list) {
      const k = e.kind;
      byKind[k] ??= { count: 0, amount: 0, settlement: 0 };
      byKind[k].count += 1;
      byKind[k].amount += e.iso.amount;
      byKind[k].settlement += e.iso.settlementAmount;
    }
    return {
      total: list.length,
      byKind,
      netSettlement:
        (byKind.settlement?.settlement ?? 0) - (byKind.refund?.settlement ?? 0),
    };
  },
};
