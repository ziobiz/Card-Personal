import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import {
  DEFAULT_GROUP_MENUS,
  DEFAULT_PARTNER_GROUP_MENUS,
  HQ_MENU_KEYS,
  PARTNER_MENU_KEYS,
  normalizeMenus,
} from '../lib/accessMenus.js';

export type AccessOwner = 'HQ' | string;

export interface AccessGroup {
  id: string;
  owner: AccessOwner;
  code: 'general' | 'settlement' | 'issuance' | string;
  name: string;
  menus: string[];
  builtIn: boolean;
  createdAt: string;
  updatedAt?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'access_groups.json');

function seedOwner(owner: AccessOwner): AccessGroup[] {
  const now = new Date().toISOString();
  const partner = owner !== 'HQ';
  const names = partner
    ? { general: 'General admin', settlement: 'Settlement', issuance: 'Issuance' }
    : { general: '일반관리자', settlement: '정산팀', issuance: '발급팀' };
  const menus = partner ? DEFAULT_PARTNER_GROUP_MENUS : DEFAULT_GROUP_MENUS;
  return (['general', 'settlement', 'issuance'] as const).map((code) => ({
    id: `grp_${owner === 'HQ' ? 'hq' : owner.slice(-8)}_${code}`,
    owner,
    code,
    name: names[code],
    menus: [...(menus[code] || [])],
    builtIn: true,
    createdAt: now,
  }));
}

function load(): AccessGroup[] {
  if (!existsSync(FILE)) {
    const s = seedOwner('HQ');
    writeFileSync(FILE, JSON.stringify({ groups: s }, null, 2), 'utf-8');
    return s;
  }
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).groups ?? seedOwner('HQ');
  } catch {
    return seedOwner('HQ');
  }
}

function save(list: AccessGroup[]) {
  writeFileSync(FILE, JSON.stringify({ groups: list }, null, 2), 'utf-8');
}

let cached = load();

export const accessGroupStore = {
  list(owner: AccessOwner = 'HQ'): AccessGroup[] {
    if (owner !== 'HQ' && !cached.some((g) => g.owner === owner)) {
      cached = [...cached, ...seedOwner(owner)];
      save(cached);
    }
    return cached.filter((g) => g.owner === owner).map((g) => ({ ...g, menus: [...g.menus] }));
  },

  get(id: string): AccessGroup | undefined {
    return cached.find((g) => g.id === id);
  },

  create(data: { owner?: AccessOwner; name: string; menus?: string[]; code?: string }): AccessGroup {
    const owner = data.owner || 'HQ';
    const catalog = owner === 'HQ' ? HQ_MENU_KEYS : PARTNER_MENU_KEYS;
    const item: AccessGroup = {
      id: 'grp_' + randomBytes(5).toString('hex'),
      owner,
      code: (data.code || 'custom').toLowerCase(),
      name: data.name.trim() || 'Group',
      menus: normalizeMenus(data.menus, catalog),
      builtIn: false,
      createdAt: new Date().toISOString(),
    };
    cached = [...cached, item];
    save(cached);
    return item;
  },

  update(id: string, data: { name?: string; menus?: string[] }): AccessGroup | undefined {
    const g = cached.find((x) => x.id === id);
    if (!g) return undefined;
    if (typeof data.name === 'string' && data.name.trim()) g.name = data.name.trim();
    if (data.menus) {
      const catalog = g.owner === 'HQ' ? HQ_MENU_KEYS : PARTNER_MENU_KEYS;
      g.menus = normalizeMenus(data.menus, catalog);
    }
    g.updatedAt = new Date().toISOString();
    save(cached);
    return { ...g, menus: [...g.menus] };
  },

  remove(id: string): boolean {
    const g = cached.find((x) => x.id === id);
    if (!g || g.builtIn) return false;
    cached = cached.filter((x) => x.id !== id);
    save(cached);
    return true;
  },
};
