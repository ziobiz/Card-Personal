/**
 * 앱 사용자 저장소
 * JSON 파일로 영구 저장 - 백엔드 재시작 후에도 로그인 가능
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface AppUser {
  id: string;
  email: string;
  passwordHash: string;
  wirexUserId?: string;
  /** 사용자 EOA — Wirex 표준 헤더 X-User-Address */
  walletAddress?: string;
  country?: string;
  kycStatus?: 'pending' | 'verified' | 'rejected';
  kycLevel?: string;
  capabilities?: string[];
  /** direct = ICOCARD 자체 회원, partner = 파트너 API 회원 */
  source?: 'direct' | 'partner';
  partnerId?: string;
  status?: 'active' | 'suspended';
  otpSecret?: string;
  otpEnabled?: boolean;
  /** WebAuthn platform authenticator credentials (mobile biometrics) */
  webauthnCredentials?: WebAuthnCredential[];
  createdAt: string;
}

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceType?: string;
  backedUp?: boolean;
  createdAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const pathByDirname = join(__dirname, 'users.json');
const pathByCwd = join(process.cwd(), 'src', 'data', 'users.json');
const DATA_FILE = existsSync(pathByDirname) ? pathByDirname : pathByCwd;

export function getDataFilePath(): string {
  return DATA_FILE;
}

function loadFromFile(): { users: AppUser[] } {
  if (!existsSync(DATA_FILE)) return { users: [] };
  try {
    const data = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { users: [] };
  }
}

function saveToFile(users: AppUser[]): void {
  try {
    writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save users:', e);
  }
}

const users = new Map<string, AppUser>();
const emailIndex = new Map<string, string>();

function loadUsers(): void {
  users.clear();
  emailIndex.clear();
  const initial = loadFromFile();
  for (const u of initial.users) {
    users.set(u.id, u);
    emailIndex.set(u.email.toLowerCase(), u.id);
  }
  console.log('[STORE] Loaded from', DATA_FILE, 'users:', initial.users.length);
}

loadUsers();

export const store = {
  users,
  emailIndex,
  loadUsers,

  addUser(user: AppUser): void {
    users.set(user.id, user);
    emailIndex.set(user.email.toLowerCase(), user.id);
    saveToFile(Array.from(users.values()));
  },

  getUserById(id: string): AppUser | undefined {
    return users.get(id);
  },

  getUserByEmail(email: string): AppUser | undefined {
    const id = emailIndex.get(email.toLowerCase());
    return id ? users.get(id) : undefined;
  },

  getUserByWirexUserId(wirexUserId: string): AppUser | undefined {
    for (const u of users.values()) {
      if (u.wirexUserId === wirexUserId) return u;
    }
    return undefined;
  },

  updateKyc(
    userId: string,
    data: { kycStatus?: AppUser['kycStatus']; kycLevel?: string; capabilities?: string[] }
  ): void {
    const user = users.get(userId);
    if (user) {
      if (data.kycStatus) user.kycStatus = data.kycStatus;
      if (data.kycLevel) user.kycLevel = data.kycLevel;
      if (data.capabilities) user.capabilities = data.capabilities;
      saveToFile(Array.from(users.values()));
    }
  },

  updateWirexUserId(userId: string, wirexUserId: string, extra?: { walletAddress?: string; country?: string }): void {
    const user = users.get(userId);
    if (user) {
      user.wirexUserId = wirexUserId;
      if (extra?.walletAddress) user.walletAddress = extra.walletAddress;
      if (extra?.country) user.country = extra.country;
      saveToFile(Array.from(users.values()));
    }
  },

  /** 파트너 API용 사용자 생성 (비밀번호 없음, 웹 로그인 불가) */
  addPartnerUser(user: Omit<AppUser, 'passwordHash'> & { passwordHash?: string }): AppUser {
    const full: AppUser = {
      ...user,
      passwordHash: user.passwordHash ?? '[partner]',
    };
    users.set(full.id, full);
    emailIndex.set(full.email.toLowerCase(), full.id);
    saveToFile(Array.from(users.values()));
    return full;
  },

  updateMember(id: string, data: { status?: AppUser['status'] }): AppUser | undefined {
    const user = users.get(id);
    if (!user) return undefined;
    if (data.status) user.status = data.status;
    saveToFile(Array.from(users.values()));
    return user;
  },

  updateOtp(
    id: string,
    data: { otpSecret?: string | null; otpEnabled?: boolean }
  ): AppUser | undefined {
    const user = users.get(id);
    if (!user) return undefined;
    if (data.otpSecret === null) delete user.otpSecret;
    else if (data.otpSecret != null) user.otpSecret = data.otpSecret;
    if (data.otpEnabled != null) user.otpEnabled = data.otpEnabled;
    saveToFile(Array.from(users.values()));
    return user;
  },

  setWebauthnCredentials(id: string, credentials: WebAuthnCredential[]): AppUser | undefined {
    const user = users.get(id);
    if (!user) return undefined;
    user.webauthnCredentials = credentials;
    saveToFile(Array.from(users.values()));
    return user;
  },

  addWebauthnCredential(id: string, cred: WebAuthnCredential): AppUser | undefined {
    const user = users.get(id);
    if (!user) return undefined;
    const list = [...(user.webauthnCredentials || [])].filter((c) => c.id !== cred.id);
    list.push(cred);
    user.webauthnCredentials = list;
    saveToFile(Array.from(users.values()));
    return user;
  },

  updateWebauthnCounter(id: string, credId: string, counter: number): void {
    const user = users.get(id);
    if (!user?.webauthnCredentials) return;
    const c = user.webauthnCredentials.find((x) => x.id === credId);
    if (!c) return;
    c.counter = counter;
    saveToFile(Array.from(users.values()));
  },
};
