import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface ThreeDsChallenge {
  transactionId: string;
  userId?: string;
  cardId?: string;
  amount?: number;
  currency?: string;
  merchant?: string;
  status: 'pending' | 'approved' | 'declined';
  payload: unknown;
  receivedAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'threeds.json');

function load(): ThreeDsChallenge[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).items ?? [];
  } catch {
    return [];
  }
}

function save(items: ThreeDsChallenge[]): void {
  try {
    writeFileSync(FILE, JSON.stringify({ items: items.slice(-200) }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save 3ds:', e);
  }
}

const items: ThreeDsChallenge[] = load();

export const threeDsStore = {
  upsert(ch: ThreeDsChallenge): void {
    const i = items.findIndex((x) => x.transactionId === ch.transactionId);
    if (i >= 0) items[i] = ch;
    else items.push(ch);
    save(items);
  },
  listPending(userId?: string): ThreeDsChallenge[] {
    return items.filter((x) => x.status === 'pending' && (!userId || x.userId === userId));
  },
  setStatus(transactionId: string, status: 'approved' | 'declined'): ThreeDsChallenge | undefined {
    const ch = items.find((x) => x.transactionId === transactionId);
    if (ch) {
      ch.status = status;
      save(items);
    }
    return ch;
  },
};
