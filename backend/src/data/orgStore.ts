/**
 * 영업 조직 — ziobiz/PG OrgLevel / OrgUnit 과 동일 계층
 * 총본사 → 본사 → 총판 → 지사 → 대리점 → 영업점 → 가맹점(파트너)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

export const ORG_LEVELS = [
  'HEADQUARTERS',
  'REGIONAL',
  'MASTER_DIST',
  'BRANCH',
  'AGENCY',
  'SALES_OFFICE',
  'MERCHANT',
] as const;

export type OrgLevel = (typeof ORG_LEVELS)[number];

export const ORG_LEVEL_RANK: Record<OrgLevel, number> = {
  HEADQUARTERS: 1,
  REGIONAL: 2,
  MASTER_DIST: 3,
  BRANCH: 4,
  AGENCY: 5,
  SALES_OFFICE: 6,
  MERCHANT: 7,
};

export interface OrgProfile {
  bizKind?: string;
  businessNo?: string;
  bizType?: string;
  bizItem?: string;
  ceoName?: string;
  mobile?: string;
  phone?: string;
  fax?: string;
  email?: string;
  country?: string;
  zip?: string;
  address?: string;
  addressDetail?: string;
  loginId?: string;
}

export interface OrgUnit extends OrgProfile {
  id: string;
  orgLevel: OrgLevel;
  parentId?: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  partnerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export function parseOrgProfile(body: Record<string, unknown> | undefined): OrgProfile {
  const s = (k: string) => {
    const v = body?.[k];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  return {
    bizKind: s('bizKind'),
    businessNo: s('businessNo'),
    bizType: s('bizType'),
    bizItem: s('bizItem'),
    ceoName: s('ceoName'),
    mobile: s('mobile'),
    phone: s('phone'),
    fax: s('fax'),
    email: s('email'),
    country: s('country') || 'KR',
    zip: s('zip'),
    address: s('address'),
    addressDetail: s('addressDetail'),
    loginId: s('loginId')?.toLowerCase(),
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'org_units.json');

function load(): OrgUnit[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).units ?? [];
  } catch {
    return [];
  }
}

function save(units: OrgUnit[]): void {
  try {
    writeFileSync(FILE, JSON.stringify({ units }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save org units:', e);
  }
}

const units = new Map<string, OrgUnit>();

function persist() {
  save(Array.from(units.values()));
}

function seedHq() {
  if ([...units.values()].some((u) => u.orgLevel === 'HEADQUARTERS')) return;
  const hq: OrgUnit = {
    id: 'org_hq',
    orgLevel: 'HEADQUARTERS',
    code: 'HQ',
    name: 'ICOCARD 총본사',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  units.set(hq.id, hq);
  persist();
}

for (const u of load()) units.set(u.id, u);
seedHq();

export const orgStore = {
  levels() {
    return ORG_LEVELS.map((code) => ({ code, rank: ORG_LEVEL_RANK[code] }));
  },

  list(orgLevel?: OrgLevel): OrgUnit[] {
    const all = Array.from(units.values());
    return orgLevel ? all.filter((u) => u.orgLevel === orgLevel) : all;
  },

  get(id: string): OrgUnit | undefined {
    return units.get(id);
  },

  parentsFor(level: OrgLevel): OrgUnit[] {
    const rank = ORG_LEVEL_RANK[level];
    return Array.from(units.values()).filter(
      (u) => u.status === 'ACTIVE' && ORG_LEVEL_RANK[u.orgLevel] < rank
    );
  },

  chain(id?: string): OrgUnit[] {
    const out: OrgUnit[] = [];
    let cur = id ? units.get(id) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.push(cur);
      cur = cur.parentId ? units.get(cur.parentId) : undefined;
    }
    return out;
  },

  create(data: {
    orgLevel: OrgLevel;
    parentId?: string;
    code?: string;
    name: string;
    partnerId?: string;
    profile?: OrgProfile;
  }): OrgUnit {
    if (!ORG_LEVELS.includes(data.orgLevel)) throw new Error('invalid orgLevel');
    if (data.orgLevel === 'HEADQUARTERS') throw new Error('HEADQUARTERS already exists');
    const parentId = data.parentId || 'org_hq';
    const parent = units.get(parentId);
    if (!parent) throw new Error('parent not found');
    if (ORG_LEVEL_RANK[parent.orgLevel] >= ORG_LEVEL_RANK[data.orgLevel]) {
      throw new Error('parent must be a higher organization');
    }
    const unit: OrgUnit = {
      id: 'org_' + randomBytes(6).toString('hex'),
      orgLevel: data.orgLevel,
      parentId,
      code: (data.code || data.name.slice(0, 12)).replace(/\s+/g, '_').toUpperCase(),
      name: data.name,
      status: 'ACTIVE',
      partnerId: data.partnerId,
      createdAt: new Date().toISOString(),
      ...(data.profile ?? {}),
    };
    units.set(unit.id, unit);
    persist();
    return unit;
  },

  update(
    id: string,
    data: Partial<
      Pick<
        OrgUnit,
        | 'name'
        | 'code'
        | 'parentId'
        | 'status'
        | 'partnerId'
        | 'bizKind'
        | 'businessNo'
        | 'bizType'
        | 'bizItem'
        | 'ceoName'
        | 'mobile'
        | 'phone'
        | 'fax'
        | 'email'
        | 'country'
        | 'zip'
        | 'address'
        | 'addressDetail'
        | 'loginId'
      >
    >
  ): OrgUnit | undefined {
    const u = units.get(id);
    if (!u) return undefined;
    if (u.orgLevel === 'HEADQUARTERS' && data.parentId) throw new Error('cannot reparent headquarters');
    if (data.parentId) {
      const p = units.get(data.parentId);
      if (!p) throw new Error('parent not found');
      if (ORG_LEVEL_RANK[p.orgLevel] >= ORG_LEVEL_RANK[u.orgLevel]) throw new Error('parent must be higher');
      u.parentId = data.parentId;
    }
    if (data.name != null) u.name = data.name;
    if (data.code != null) u.code = data.code;
    if (data.status != null) {
      u.status = data.status;
      if (data.status === 'INACTIVE') {
        for (const child of units.values()) {
          if (child.parentId === id) child.status = 'INACTIVE';
        }
      }
    }
    if (data.partnerId !== undefined) u.partnerId = data.partnerId;
    const profileKeys = [
      'bizKind',
      'businessNo',
      'bizType',
      'bizItem',
      'ceoName',
      'mobile',
      'phone',
      'fax',
      'email',
      'country',
      'zip',
      'address',
      'addressDetail',
      'loginId',
    ] as const;
    for (const k of profileKeys) {
      if (data[k] !== undefined) (u as OrgUnit)[k] = data[k] as never;
    }
    u.updatedAt = new Date().toISOString();
    persist();
    return u;
  },
};
