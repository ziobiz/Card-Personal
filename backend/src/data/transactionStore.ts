/**
 * 거래 내역 저장소
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export type TransactionType =
  | 'card_issue'
  | 'card_topup'
  | 'card_usage'
  | 'p2p'
  | 'refund'
  | 'fee'
  | 'partner_billing';

export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  type: TransactionType;
  userId?: string;
  partnerId?: string;
  amount: number;
  fee: number;
  currency: string;
  status: TransactionStatus;
  fromUserId?: string;
  toUserId?: string;
  cardId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'transactions.json');

function load(): Transaction[] {
  if (!existsSync(FILE)) return [];
  try {
    const data = readFileSync(FILE, 'utf-8');
    return JSON.parse(data).transactions ?? [];
  } catch {
    return [];
  }
}

function save(tx: Transaction[]): void {
  try {
    writeFileSync(FILE, JSON.stringify({ transactions: tx }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save transactions:', e);
  }
}

const transactions: Transaction[] = load();

function nextId(): string {
  return 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const transactionStore = {
  add(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const full: Transaction = {
      ...tx,
      id: nextId(),
      createdAt: new Date().toISOString(),
    };
    transactions.push(full);
    save(transactions);
    return full;
  },

  list(filters?: { userId?: string; partnerId?: string; type?: TransactionType; cardId?: string; from?: string; to?: string }): Transaction[] {
    let list = [...transactions];
    if (filters?.userId) list = list.filter((t) => t.userId === filters!.userId || t.fromUserId === filters!.userId || t.toUserId === filters!.userId);
    if (filters?.partnerId) list = list.filter((t) => t.partnerId === filters!.partnerId);
    if (filters?.type) list = list.filter((t) => t.type === filters!.type);
    if (filters?.cardId) list = list.filter((t) => t.cardId === filters!.cardId);
    if (filters?.from) list = list.filter((t) => t.createdAt >= filters!.from!);
    if (filters?.to) list = list.filter((t) => t.createdAt <= filters!.to!);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getCardUsage(cardId: string): Transaction[] {
    return transactions.filter((t) => t.type === 'card_usage' && t.cardId === cardId);
  },
};
