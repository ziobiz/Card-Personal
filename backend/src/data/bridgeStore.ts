/**
 * Bridge ledger: non-connectable wallets credit/debit into our Smart Wallet rail.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

export type BridgeEntry = {
  id: string;
  partnerId: string;
  userId: string;
  direction: 'credit' | 'debit_request';
  amount: number;
  currency: string;
  status: 'pending' | 'posted' | 'failed' | 'rejected';
  externalRef?: string;
  note?: string;
  createdAt: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'bridge_ledger.json');

function load(): BridgeEntry[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).items ?? [];
  } catch {
    return [];
  }
}

function save(items: BridgeEntry[]) {
  writeFileSync(FILE, JSON.stringify({ items }, null, 2), 'utf-8');
}

const items = load();

export const bridgeStore = {
  list(filter?: { partnerId?: string; userId?: string }): BridgeEntry[] {
    return items.filter((e) => {
      if (filter?.partnerId && e.partnerId !== filter.partnerId) return false;
      if (filter?.userId && e.userId !== filter.userId) return false;
      return true;
    });
  },

  add(partial: Omit<BridgeEntry, 'id' | 'createdAt'>): BridgeEntry {
    const row: BridgeEntry = {
      ...partial,
      id: 'brg_' + randomBytes(8).toString('hex'),
      createdAt: new Date().toISOString(),
    };
    items.unshift(row);
    save(items);
    return row;
  },

  update(id: string, data: Partial<Pick<BridgeEntry, 'status' | 'note' | 'externalRef'>>): BridgeEntry | undefined {
    const row = items.find((e) => e.id === id);
    if (!row) return undefined;
    Object.assign(row, data);
    save(items);
    return row;
  },
};
