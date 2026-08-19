/**
 * 사용자관리 — 본사/파트너 운영자 계정 (카드 회원과 분리)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import { config } from '../config.js';
import { generateOtpSecret } from '../lib/totp.js';

export type OperatorScope = 'HQ' | 'PARTNER';
export type OperatorRole = 'ADMIN' | 'STAFF';

export interface Operator {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  scope: OperatorScope;
  role: OperatorRole;
  partnerId?: string;
  orgUnitId?: string;
  mustChangePassword?: boolean;
  otpSecret?: string;
  otpEnabled?: boolean;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'operators.json');

function hashPassword(password: string): string {
  return createHash('sha256').update(password + config.jwtSecret).digest('hex');
}

function load(): Operator[] {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8')).operators ?? [];
  } catch {
    return [];
  }
}

function save(list: Operator[]): void {
  writeFileSync(DATA_FILE, JSON.stringify({ operators: list }, null, 2), 'utf-8');
}

const operators = new Map<string, Operator>();

function seedHq() {
  const emails = [config.adminEmail, 'admin@icocard.local', 'admin@wirexcard.local']
    .map((e) => e.toLowerCase())
    .filter((v, i, a) => a.indexOf(v) === i);
  for (const email of emails) {
    if ([...operators.values()].some((o) => o.email === email)) continue;
    const id = randomUUID();
    const op: Operator = {
      id,
      email,
      name: 'HQ Admin',
      passwordHash: hashPassword(config.adminPassword),
      scope: 'HQ',
      role: 'ADMIN',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    operators.set(id, op);
  }
}

function reload() {
  operators.clear();
  for (const o of load()) operators.set(o.id, o);
  seedHq();
  save(Array.from(operators.values()));
}

reload();

export const operatorStore = {
  hashPassword,
  list(scope?: OperatorScope): Operator[] {
    const all = Array.from(operators.values());
    return scope ? all.filter((o) => o.scope === scope) : all;
  },
  getById(id: string): Operator | undefined {
    return operators.get(id);
  },
  getByEmail(email: string): Operator | undefined {
    const e = email.trim().toLowerCase();
    return Array.from(operators.values()).find((o) => o.email === e);
  },
  create(data: {
    email: string;
    name: string;
    password: string;
    scope: OperatorScope;
    role?: OperatorRole;
    partnerId?: string;
    orgUnitId?: string;
    mustChangePassword?: boolean;
  }): Operator {
    const email = data.email.trim().toLowerCase();
    if (!email || !data.password || data.password.length < 4) throw new Error('email and password required');
    if (this.getByEmail(email)) throw new Error('Email already registered');
    if (data.scope === 'PARTNER' && !data.partnerId) throw new Error('partnerId required');
    const op: Operator = {
      id: randomUUID(),
      email,
      name: data.name.trim() || email,
      passwordHash: hashPassword(data.password),
      scope: data.scope,
      role: data.role === 'STAFF' ? 'STAFF' : 'ADMIN',
      partnerId: data.scope === 'PARTNER' ? data.partnerId : undefined,
      orgUnitId: data.orgUnitId,
      mustChangePassword: data.mustChangePassword !== false,
      otpSecret: generateOtpSecret(),
      otpEnabled: true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    operators.set(op.id, op);
    save(Array.from(operators.values()));
    return op;
  },
  update(
    id: string,
    data: Partial<Pick<Operator, 'name' | 'role' | 'status' | 'partnerId' | 'orgUnitId' | 'mustChangePassword' | 'otpEnabled' | 'otpSecret'>> & {
      password?: string;
    }
  ): Operator | undefined {
    const o = operators.get(id);
    if (!o) return undefined;
    if (data.name != null) o.name = data.name;
    if (data.role != null) o.role = data.role;
    if (data.status != null) o.status = data.status;
    if (data.partnerId != null) o.partnerId = data.partnerId;
    if (data.orgUnitId != null) o.orgUnitId = data.orgUnitId;
    if (data.mustChangePassword != null) o.mustChangePassword = data.mustChangePassword;
    if (data.otpEnabled != null) o.otpEnabled = data.otpEnabled;
    if (data.otpSecret != null) o.otpSecret = data.otpSecret;
    if (data.password) {
      o.passwordHash = hashPassword(data.password);
      o.mustChangePassword = false;
    }
    o.updatedAt = new Date().toISOString();
    save(Array.from(operators.values()));
    return o;
  },
  publicView(o: Operator) {
    return {
      id: o.id,
      email: o.email,
      name: o.name,
      scope: o.scope,
      role: o.role,
      partnerId: o.partnerId,
      orgUnitId: o.orgUnitId,
      mustChangePassword: Boolean(o.mustChangePassword),
      otpEnabled: Boolean(o.otpEnabled),
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  },
};
