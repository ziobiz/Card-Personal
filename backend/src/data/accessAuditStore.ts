import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

export interface AccessAudit {
  id: string;
  at: string;
  actorId: string;
  actorEmail: string;
  owner: string;
  targetType: 'operator' | 'group';
  targetId: string;
  action: 'create' | 'update' | 'status' | 'menus' | 'group' | 'password' | 'otp';
  detail: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'access_audit.json');

function load(): AccessAudit[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).items ?? [];
  } catch {
    return [];
  }
}

function save(list: AccessAudit[]) {
  writeFileSync(FILE, JSON.stringify({ items: list.slice(-800) }, null, 2), 'utf-8');
}

let cached = load();

export const accessAuditStore = {
  list(owner?: string, targetId?: string): AccessAudit[] {
    return cached
      .filter((x) => (!owner || x.owner === owner) && (!targetId || x.targetId === targetId))
      .slice()
      .reverse();
  },
  add(row: Omit<AccessAudit, 'id' | 'at'>): AccessAudit {
    const item: AccessAudit = {
      ...row,
      id: 'aud_' + randomBytes(6).toString('hex'),
      at: new Date().toISOString(),
    };
    cached = [...cached, item];
    save(cached);
    return item;
  },
};
