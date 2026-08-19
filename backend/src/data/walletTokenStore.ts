import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export type DigitalWallet = 'apple_pay' | 'google_pay';

export interface WalletToken {
  id: string;
  userId: string;
  cardId: string;
  wallet: DigitalWallet;
  tokenReference: string;
  status: 'active' | 'suspended' | 'deleted';
  deviceId?: string;
  createdAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'wallet_tokens.json');

function load(): WalletToken[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).tokens ?? [];
  } catch {
    return [];
  }
}

function save(tokens: WalletToken[]): void {
  try {
    writeFileSync(FILE, JSON.stringify({ tokens }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save wallet tokens:', e);
  }
}

const tokens: WalletToken[] = load();

export const walletTokenStore = {
  add(t: Omit<WalletToken, 'id' | 'createdAt' | 'status'> & { status?: WalletToken['status'] }): WalletToken {
    const full: WalletToken = {
      ...t,
      id: 'dpan_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      status: t.status ?? 'active',
      createdAt: new Date().toISOString(),
    };
    tokens.push(full);
    save(tokens);
    return full;
  },
  list(userId: string, cardId?: string): WalletToken[] {
    return tokens.filter((t) => t.userId === userId && (!cardId || t.cardId === cardId));
  },
};
