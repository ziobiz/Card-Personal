/**
 * 백엔드 API 클라이언트
 * Wirex API 스펙 기반
 */

import { getAdminToken, kickToAdminLogin } from './lib/adminSession';

// 직접 연결 (프록시 미사용) - dev: 127.0.0.1:3001, prod: VITE_API_URL
const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

function bearerFor(path: string): string | null {
  if (path.startsWith('/admin')) return getAdminToken();
  if (path.startsWith('/partner-portal')) {
    try {
      return localStorage.getItem('partnerToken');
    } catch {
      return null;
    }
  }
  return getToken();
}

function shouldKickAdminSession(path: string, status: number, message: string): boolean {
  if (!path.startsWith('/admin')) return false;
  if (path === '/admin/login' || path.startsWith('/admin/otp/')) return false;
  if (status === 401) return true;
  if (status === 403 && /Admin access required|Invalid token|Unauthorized|OTP required/i.test(message)) return true;
  return false;
}

const REQUEST_TIMEOUT = 15000;

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT
): Promise<T> {
  const token = bearerFor(path);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token && !headers.Authorization) headers['Authorization'] = `Bearer ${token}`;
  try {
    const slug = typeof window !== 'undefined'
      ? window.location.pathname.match(/^\/s\/([^/]+)/)?.[1]
      : '';
    if (slug) headers['X-ICO-Tenant-Slug'] = decodeURIComponent(slug);
  } catch {
    /* ignore */
  }

  const base = API || '';
  const url = base ? `${base}/api${path}` : `/api${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg =
        data.message ||
        (data.hint ? `${data.error} (${data.hint})` : data.error) ||
        `HTTP ${res.status}`;
      if (data._debug) msg += ` [받은이메일:${data._debug.receivedEmail}, 사용자수:${data._debug.usersCount}]`;
      if (shouldKickAdminSession(path, res.status, String(msg))) kickToAdminLogin();
      const err = new Error(msg) as Error & { status?: number; body?: unknown; code?: string };
      err.status = res.status;
      err.body = data;
      if (typeof data.code === 'string') err.code = data.code;
      throw err;
    }
    return data as T;
  } catch (e) {
    clearTimeout(timeoutId);
    if ((e as Error).name === 'AbortError') {
      throw new Error('요청 시간 초과. 백엔드가 실행 중인지 확인해 주세요.');
    }
    throw e;
  }
}

export type HealthLevel = 'ok' | 'warn' | 'danger';

export type PlatformPayload = {
  generatedAt: string;
  uiAutoRefreshSeconds: number;
  config: {
    primaryDomain: string;
    apiPublicUrl: string;
    corsOrigins: string[];
    sslCertPath: string;
    sslLeDomain: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
    smtpFromName: string;
    otpExpireMinutes: number;
    uiRefreshSec: number;
    nginxStubStatusUrl: string;
    contractDiskGb: number | null;
    contractTrafficGb: number | null;
    trafficUsedGb: number | null;
    contractStart: string;
    contractEnd: string;
  };
  security: { otpRequiredAdmin: boolean; otpRequiredMember: boolean; otpRequiredOrg: boolean };
  ssl: {
    status: string;
    detail: string;
    daysRemaining: number | null;
    notAfter: string | null;
    notBefore: string | null;
    subjectDn: string;
    issuerDn: string;
    fingerprintSha256: string;
    sanDnsNames: string[];
    leLiveCertName: string;
    resolvedPath: string;
  };
  host: {
    hostname: string;
    osFamily: string;
    osVersion: string;
    arch: string;
    memoryTotalMb: number;
    memoryAvailableMb: number;
    cpuCount: number;
    uptimeSec: number;
    loadAvg: number[];
  };
  process: {
    nodeVersion: string;
    heapUsedMb: number;
    heapMaxMb: number;
    heapUsedPct: number;
    rssMb: number;
    cpuCount: number;
    load1: number | null;
    uptimeMs: number;
  };
  disk: {
    ok: boolean;
    pathRoot: string;
    totalBytes: number;
    usableBytes: number;
    usedBytes: number;
    usedPct: number;
    error?: string;
  };
  health: {
    worstStatus: HealthLevel;
    alerts: Array<{ key: string; args: unknown[]; level: HealthLevel }>;
    rows: Array<{
      id: string;
      status: HealthLevel;
      labelKey: string;
      value: string;
      criteria: string;
      pct: number | null;
    }>;
  };
  certbot: { renewalConfFiles: string[]; timerActive: string; timerNext: string };
  nginxStub: {
    configured: boolean;
    ok: boolean;
    active?: number;
    reading?: number;
    writing?: number;
    waiting?: number;
    error?: string;
  };
  linkage: {
    sanDnsNames: string[];
    rows: Array<{ hostname: string; source: string; inCertificate: boolean }>;
    missing: string[];
    sanOnly: string[];
  };
  contract: {
    diskGb: number | null;
    trafficGb: number | null;
    trafficUsedGb: number | null;
    periodStart: string;
    periodEnd: string;
  };
  pm2: Array<{ name: string; status: string; cpu: number; memoryMb: number; uptimeMs: number; restarts: number }>;
  metrics: Array<{
    date: string;
    memUsedPct: number;
    diskUsedPct: number;
    heapUsedPct: number;
    load1: number;
    trafficUsedGb: number | null;
  }>;
  server: { hostname: string; uptimeSec: number; memTotalMb: number; memFreeMb: number; loadAvg: number[] };
};

export interface User {
  id: string;
  email: string;
  wirexUserId?: string;
}

export interface MemberProfile {
  id: string;
  email: string;
  displayName?: string;
  phone?: string;
  country?: string;
  wirexUserId?: string | null;
  walletAddress?: string;
  kycStatus?: string;
  onboarding?: {
    status?: string;
    error?: string | null;
    eoa?: string;
    smartWallet?: string;
    walletMode?: 'embedded' | 'external_eoa' | 'bridge';
  };
  source?: string;
  status?: string;
  createdAt?: string;
  otpEnabled?: boolean;
  biometricEnabled?: boolean;
  biometricCount?: number;
  mock?: boolean;
}

export interface Card {
  id: string;
  userId: string;
  type: 'virtual' | 'plastic';
  status: 'inactive' | 'active' | 'blocked' | 'closed';
  panLast4: string;
  expiryMonth: string;
  expiryYear: string;
  limit?: number;
  limitType?: 'daily' | 'lifetime';
  dailyLimit?: number;
  dailyUsed?: number;
  dailyUsedResetAt?: string;
  lifetimeLimit?: number;
  lifetimeUsed?: number;
  currency: string;
  cardWalletAddress?: string;
  balance?: number;
  createdAt: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  currency: string;
  status: string;
  cardId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PartnerFeeFields {
  cardIssuanceFee?: number;
  cardTopUpFeePercent?: number;
  cardUsageFeePerTransaction?: number;
  cardMonthlyFee?: number;
  partnerMonthlyFee?: number;
}

export interface CredentialKit {
  issuer: string;
  warning: string;
  mid: string;
  environment: string;
  deliveryMode: string;
  solutionSlug?: string;
  solutionUrl?: string;
  apiKey: string;
  apiSecret: string;
  hmacSecret: string;
  auth: {
    apiKeyHeader: string;
    secretHeader: string;
    hmac: { timestamp: string; signature: string; mid: string };
    user: string;
  };
  endpoints: Record<string, string>;
}

export interface WalletBalance {
  primary: TokenBalance[];
  cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
}

export interface BrandColorSet {
  headerBg: string;
  sidebarBg: string;
  sidebarHover: string;
  sidebarActive: string;
  sidebarSub: string;
  sidebarText: string;
  logoBg: string;
  tabbarBg: string;
  tabbarText: string;
  tabbarActive: string;
  foldBg: string;
  foldHover: string;
  accentColor: string;
  loginPanelBg: string;
}

export interface BrandColorPreset {
  name: string;
  colors: BrandColorSet;
}

export interface BrandConfig extends BrandColorSet {
  productName: string;
  operatorName: string;
  cardBrandName: string;
  copyright: string;
  supportEmail: string;
  logoAdmin: string;
  logoLogin: string;
  /** Member after-login top/side logo (empty → logoLogin) */
  logoMemberShell?: string;
  /** Admin after-login sidebar logo (empty → logoAdmin) */
  logoAdminShell?: string;
  favicon: string;
  /** Browser tab and bookmark name. Empty → productName */
  browserTitle?: string;
  /** Admin login left hero — independent of member */
  loginHeroImage?: string;
  /** Member login page background — independent of admin */
  memberLoginHeroImage?: string;
  loginMainText?: string;
  loginNoticeEnabled?: boolean;
  loginNoticeTitle?: string;
  loginNoticeBody?: string;
  /** Open Graph — member surface (LINE/WhatsApp preview) */
  ogMemberTitle?: string;
  ogMemberDescription?: string;
  ogMemberImage?: string;
  /** Open Graph — admin surface (separate from member) */
  ogAdminTitle?: string;
  ogAdminDescription?: string;
  ogAdminImage?: string;
  turnstileSiteKey?: string;
  turnstileEnabled?: boolean;
  enabledLocales?: string[];
  defaultLocale?: string;
  tenantSlug?: string;
  deliveryMode?: string;
  /** 3 named color tones (Light / Dark / custom) */
  colorPresets?: BrandColorPreset[];
  updatedAt?: string;
}

export const DEFAULT_COLORS: BrandColorSet = {
  headerBg: '#ffffff',
  sidebarBg: '#2c3138',
  sidebarHover: '#353b45',
  sidebarActive: '#252a32',
  sidebarSub: '#242933',
  sidebarText: '#d1d5db',
  logoBg: '#1f232b',
  tabbarBg: '#4a4a4a',
  tabbarText: '#c8cdd4',
  tabbarActive: '#3a3a3a',
  foldBg: '#3a4149',
  foldHover: '#454d56',
  accentColor: '#6658dd',
  loginPanelBg: '#e2e5ea',
};

export const DEFAULT_BRAND: BrandConfig = {
  productName: 'ICOCARD',
  operatorName: 'ONTHELINE',
  cardBrandName: 'ICOCARD',
  copyright: 'Copyright © 2026 ICOCARD Service by ONTHELINE',
  supportEmail: '',
  ...DEFAULT_COLORS,
  logoAdmin: '',
  logoLogin: '',
  logoMemberShell: '',
  logoAdminShell: '',
  favicon: '',
  browserTitle: '',
  loginHeroImage: '',
  memberLoginHeroImage: '',
  loginMainText: '',
  loginNoticeEnabled: true,
  loginNoticeTitle: '',
  loginNoticeBody: '',
  ogMemberTitle: '',
  ogMemberDescription: '',
  ogMemberImage: '',
  ogAdminTitle: '',
  ogAdminDescription: '',
  ogAdminImage: '',
  enabledLocales: ['ko', 'en', 'ja', 'zh', 'th'],
  defaultLocale: 'en',
  colorPresets: [
    {
      name: '밝은색',
      colors: {
        headerBg: '#ffffff',
        sidebarBg: '#f3f4f6',
        sidebarHover: '#e5e7eb',
        sidebarActive: '#d1d5db',
        sidebarSub: '#e8eaed',
        sidebarText: '#374151',
        logoBg: '#e5e7eb',
        tabbarBg: '#9ca3af',
        tabbarText: '#1f2937',
        tabbarActive: '#6b7280',
        foldBg: '#d1d5db',
        foldHover: '#c4c9d1',
        accentColor: '#4f46e5',
        loginPanelBg: '#f8f9fb',
      },
    },
    {
      name: '어두운색',
      colors: {
        headerBg: '#1a1d24',
        sidebarBg: '#15181e',
        sidebarHover: '#22262f',
        sidebarActive: '#0f1115',
        sidebarSub: '#0c0e12',
        sidebarText: '#d1d5db',
        logoBg: '#0a0c10',
        tabbarBg: '#2a2f38',
        tabbarText: '#c8cdd4',
        tabbarActive: '#1a1d24',
        foldBg: '#2a3038',
        foldHover: '#353c46',
        accentColor: '#818cf8',
        loginPanelBg: '#2c3138',
      },
    },
    {
      name: '',
      colors: { ...DEFAULT_COLORS },
    },
  ],
};

/** Member login / register / OTP mark */
export function resolveMemberLoginLogo(brand: BrandConfig): string {
  return (brand.logoLogin || '').trim() || DEFAULT_ADMIN_LOGIN_LOGO;
}

/** Member shell after login (top mark) */
export function resolveMemberShellLogo(brand: BrandConfig): string {
  return (brand.logoMemberShell || brand.logoLogin || '').trim() || DEFAULT_ADMIN_LOGIN_LOGO;
}

/** System default member login background */
export const DEFAULT_LOGIN_HERO = '/user-hero-bg.png';
/** Admin login left hero — ICOCARD brand wave */
export const DEFAULT_ADMIN_LOGIN_HERO = '/brand/admin-login-wave-default.jpg';
/** Admin login panel logo (navy mark on transparent) */
export const DEFAULT_ADMIN_LOGIN_LOGO = '/brand/icocard-logo.png';
/** Admin sidebar / dark surfaces (white mark) */
export const DEFAULT_ADMIN_SHELL_LOGO = '/brand/icocard-logo-dark.png';

/** Admin login panel logo */
export function resolveAdminLoginLogo(brand: BrandConfig): string {
  return (brand.logoAdmin || '').trim() || DEFAULT_ADMIN_LOGIN_LOGO;
}

/** Admin sidebar after login */
export function resolveAdminShellLogo(brand: BrandConfig): string {
  return (brand.logoAdminShell || brand.logoAdmin || '').trim() || DEFAULT_ADMIN_SHELL_LOGO;
}

/** Admin login left hero (does not fall back to member custom image) */
export function resolveAdminLoginHero(brand: BrandConfig): string {
  const v = (brand.loginHeroImage || '').trim();
  return v || DEFAULT_ADMIN_LOGIN_HERO;
}

/** Member login / register background */
export function resolveMemberLoginHero(brand: BrandConfig): string {
  const v = (brand.memberLoginHeroImage || '').trim();
  return v || DEFAULT_LOGIN_HERO;
}

/** @deprecated use resolveAdminLoginHero */
export function resolveLoginHero(brand: BrandConfig): string {
  return resolveAdminLoginHero(brand);
}

export async function fetchPublicBrand(slug?: string): Promise<BrandConfig> {
  const base = API || '';
  const q = slug ? `?slug=${encodeURIComponent(slug)}` : '';
  const url = base ? `${base}/api/brand${q}` : `/api/brand${q}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return DEFAULT_BRAND;
    return { ...DEFAULT_BRAND, ...(await res.json()) };
  } catch {
    return DEFAULT_BRAND;
  }
}

export const api = {
  auth: {
    register: (email: string, password: string, extra?: { displayName?: string; country?: string }) =>
      request<{
        ok?: boolean;
        token?: string;
        user?: User;
        mustSetupOtp?: boolean;
        enrollToken?: string;
        needsApproval?: boolean;
        needsEmailVerify?: boolean;
        maskedEmail?: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...extra }),
      }),
    verifyEmail: (email: string, code: string) =>
      request<{
        ok?: boolean;
        token?: string;
        needsApproval?: boolean;
        mustSetupOtp?: boolean;
        enrollToken?: string;
        user?: User;
      }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
    resendEmailCode: (email: string, purpose?: 'register' | 'reset' | 'change_password') =>
      request<{ ok: boolean; maskedEmail?: string }>('/auth/resend-email-code', {
        method: 'POST',
        body: JSON.stringify({ email, purpose }),
      }),
    forgotPassword: (email: string) =>
      request<{ ok: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (email: string, code: string, password: string) =>
      request<{ ok: boolean }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, password }),
      }),
    registrationPolicy: () =>
      request<{ mode: 'open' | 'approval'; needsApproval: boolean }>('/auth/registration-policy'),
    login: (email: string, password: string, turnstileToken?: string) =>
      request<{
        token?: string;
        user?: User;
        otpRequired?: boolean;
        mustSetupOtp?: boolean;
        enrollToken?: string;
        mustChangePassword?: boolean;
        biometricAvailable?: boolean;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, turnstileToken }),
      }),
    verifyOtp: (code: string) =>
      request<{ token: string; user?: User; offerBiometric?: boolean }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    setupOtp: (enrollToken: string) =>
      request<{ secret: string; otpauthUrl: string; enrollToken: string }>('/auth/otp/setup', {
        method: 'POST',
        body: JSON.stringify({ enrollToken }),
      }),
    activateOtp: (enrollToken: string, code: string) =>
      request<{ token: string; user?: User; offerBiometric?: boolean }>('/auth/otp/activate', {
        method: 'POST',
        body: JSON.stringify({ enrollToken, code }),
      }),
    webauthnRegisterOptions: () => request<Record<string, unknown>>('/auth/webauthn/register/options', { method: 'POST', body: '{}' }),
    webauthnRegisterVerify: (body: unknown) =>
      request<{ ok: boolean }>('/auth/webauthn/register/verify', { method: 'POST', body: JSON.stringify(body) }),
    webauthnLoginOptions: () => request<Record<string, unknown>>('/auth/webauthn/login/options', { method: 'POST', body: '{}' }),
    webauthnLoginVerify: (body: unknown) =>
      request<{ token: string; user?: User }>('/auth/webauthn/login/verify', { method: 'POST', body: JSON.stringify(body) }),
  },
  user: {
    get: () => request<MemberProfile>('/user'),
    getManuals: () =>
      request<{ items: Array<{ id: string; outlineKeys: string[]; ready: false }>; ready: boolean }>('/user/manuals'),
    updateProfile: (data: { displayName?: string; phone?: string; country?: string }) =>
      request<{ ok: boolean; user: MemberProfile }>('/user/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    changePassword: (currentPassword: string, newPassword: string, emailCode: string) =>
      request<{ ok: boolean }>('/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, emailCode }),
      }),
    requestPasswordEmailCode: () =>
      request<{ ok: boolean }>('/user/password/email-code', { method: 'POST', body: '{}' }),
    clearBiometric: () => request<{ ok: boolean }>('/user/biometric', { method: 'DELETE' }),
    onboarding: () =>
      request<{
        ok: boolean;
        status: string;
        error: string | null;
        eoa: string;
        smartWallet: string;
        wirexUserId?: string | null;
        kycStatus?: string;
        walletMode?: 'embedded' | 'external_eoa' | 'bridge';
        allowedWalletModes?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
        walletPolicySource?: 'follow_hq' | 'custom';
        mock?: boolean;
        busy?: boolean;
      }>('/user/onboarding'),
    onboard: (data?: { issueCard?: boolean }) =>
      request<{
        ok: boolean;
        steps: { step: string; ok: boolean; detail?: unknown }[];
        kycUrl?: string | null;
        kycError?: string | null;
        card?: unknown;
        onboarding: {
          status: string;
          error: string | null;
          eoa: string;
          smartWallet: string;
          walletMode?: string;
          kycStatus?: string;
          wirexUserId?: string | null;
        };
      }>('/user/onboard', { method: 'POST', body: JSON.stringify(data ?? {}) }, 180000),
    walletChallenge: () =>
      request<{ nonce: string; message: string; expiresAt: number }>('/user/wallet/challenge'),
    walletConnect: (address: string, signature: string) =>
      request<{ ok: boolean; mode: string; address: string }>('/user/wallet/connect', {
        method: 'POST',
        body: JSON.stringify({ address, signature }),
      }, 180000),
    walletEmbedded: () =>
      request<{ ok: boolean; mode: string }>('/user/wallet/embedded', { method: 'POST', body: '{}' }, 180000),
    bridgeTopup: (amount: number, currency = 'USD') =>
      request<{ ok: boolean; entry?: unknown }>('/user/wallet/bridge/topup', {
        method: 'POST',
        body: JSON.stringify({ amount, currency }),
      }),
    bridgeLedger: () =>
      request<{
        mode: string;
        items: Array<{ id: string; amount: number; currency: string; status: string; direction: string; createdAt: string }>;
      }>('/user/wallet/bridge'),
  },
  cards: {
    list: (page = 1, size = 10) =>
      request<{ items: Card[]; total: number }>(`/cards?page=${page}&size=${size}`),
    createVirtual: (data?: { limit?: number; currency?: string }) =>
      request<Card>('/cards/virtual', {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    createPlastic: (data?: { card_name?: string; name_on_card?: string }) =>
      request<Card>('/cards/plastic', {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    provisionWallet: (cardId: string, wallet: 'apple_pay' | 'google_pay') =>
      request(`/cards/${cardId}/wallet-tokens`, {
        method: 'POST',
        body: JSON.stringify({ wallet }),
      }),
    threeDs: () => request<{ items?: unknown[] }>('/cards/3ds/requests'),
    approve3ds: (id: string) =>
      request(`/cards/3ds/${id}/approve`, { method: 'POST' }),
    decline3ds: (id: string) =>
      request(`/cards/3ds/${id}/decline`, { method: 'POST' }),
    block: (cardId: string) =>
      request<Card>(`/cards/${cardId}/block`, { method: 'PUT' }),
    unblock: (cardId: string) =>
      request<Card>(`/cards/${cardId}/unblock`, { method: 'PUT' }),
    setLimit: (cardId: string, limit: number) =>
      request<Card>(`/cards/${cardId}/limit`, {
        method: 'PUT',
        body: JSON.stringify({ limit }),
      }),
    close: (cardId: string) =>
      request<Card>(`/cards/${cardId}/close`, { method: 'PUT' }),
  },
  admin: {
    login: (email: string, password: string, turnstileToken?: string) =>
      request<{
        token?: string;
        user: { email: string; isAdmin: boolean };
        mustChangePassword?: boolean;
        otpRequired?: boolean;
        mustSetupOtp?: boolean;
        enrollToken?: string;
      }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, turnstileToken }),
      }),
    changePassword: (password: string) =>
      request<{
        ok: boolean;
        mustSetupOtp?: boolean;
        otpRequired?: boolean;
        enrollToken?: string;
        token?: string;
      }>('/admin/me/password', { method: 'PUT', body: JSON.stringify({ password }) }),
    verifyOtp: (code: string) =>
      request<{ token: string }>('/admin/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    setupOtp: (enrollToken: string) =>
      request<{ secret: string; otpauthUrl: string; enrollToken: string }>('/admin/otp/setup', {
        method: 'POST',
        body: JSON.stringify({ enrollToken }),
      }),
    activateOtp: (enrollToken: string, code: string) =>
      request<{ token: string }>('/admin/otp/activate', {
        method: 'POST',
        body: JSON.stringify({ enrollToken, code }),
      }),
    resetOperatorOtp: (id: string) =>
      request<{ ok: boolean }>(`/admin/operators/${id}/reset-otp`, { method: 'POST' }),
    resetMemberOtp: (id: string) =>
      request<{ ok: boolean }>(`/admin/members/${id}/reset-otp`, { method: 'POST' }),
    resetMemberPassword: (id: string, password?: string) =>
      request<{ ok: boolean; email: string; password: string }>(`/admin/members/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    getUsers: () =>
      request<{ items: { id: string; email: string; wirexUserId?: string; createdAt: string; source?: string; partnerId?: string }[]; total: number }>('/admin/users'),
    me: () =>
      request<{
        id: string;
        email: string;
        name: string;
        isSuper?: boolean;
        groupId?: string;
        allowedMenus: string[];
        catalog: string[];
      }>('/admin/me'),
    getManuals: () =>
      request<{ items: Array<{ id: string; outlineKeys: string[]; ready: false }>; ready: boolean }>('/admin/manuals'),
    getAccessGroups: (owner?: string) =>
      request<{ items: Array<{ id: string; code: string; name: string; menus: string[]; builtIn: boolean }>; catalog: string[]; owner: string }>(
        `/admin/access/groups${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`
      ),
    createAccessGroup: (data: { owner?: string; name: string; menus?: string[]; code?: string }) =>
      request('/admin/access/groups', { method: 'POST', body: JSON.stringify(data) }),
    updateAccessGroup: (id: string, data: { name?: string; menus?: string[] }) =>
      request(`/admin/access/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteAccessGroup: (id: string) =>
      request(`/admin/access/groups/${id}`, { method: 'DELETE' }),
    getAccessHistory: (owner?: string) =>
      request<{ items: Array<{ id: string; at: string; actorEmail: string; action: string; targetType: string; targetId: string; detail: string }> }>(
        `/admin/access/history${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`
      ),
    getOperators: (scope?: 'HQ' | 'PARTNER') =>
      request<{ items: Array<{ id: string; email: string; name: string; scope: string; role: string; partnerId?: string; partnerName?: string; status: string; createdAt: string; groupId?: string; isSuper?: boolean; menuOverride?: string[] }>; total: number }>(
        `/admin/operators${scope ? `?scope=${scope}` : ''}`
      ),
    createOperator: (data: { email: string; name: string; password: string; scope: 'HQ' | 'PARTNER'; role?: string; partnerId?: string; groupId?: string; isSuper?: boolean; menuOverride?: string[] }) =>
      request('/admin/operators', { method: 'POST', body: JSON.stringify(data) }),
    updateOperator: (id: string, data: { name?: string; role?: string; status?: string; password?: string; groupId?: string; menuOverride?: string[]; isSuper?: boolean }) =>
      request(`/admin/operators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getMembers: (source?: 'direct' | 'partner') =>
      request<{ items: Array<{ id: string; email: string; displayName?: string; wirexUserId?: string; source: string; partnerId?: string; partnerName?: string; country?: string; kycStatus?: string; otpEnabled?: boolean; status: string; createdAt: string }>; total: number }>(
        `/admin/members${source ? `?source=${source}` : ''}`
      ),
    updateMember: (id: string, data: { status?: string }) =>
      request(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getCards: () =>
      request<{
        items: Array<{ userId: string; email: string; card: Card }>;
        total: number;
      }>('/admin/cards'),
    getStats: () =>
      request<{
        totalUsers: number;
        pendingUsers: number;
        activeUsers: number;
        newUsers7d: number;
        totalPartners: number;
        totalOperators: number;
        totalOrgs: number;
        totalCards: number;
        activeCards: number;
        pendingKyc: number;
        totalBalance: number;
        estimatedRevenue: number;
        membersByDay: Array<{ date: string; value: number }>;
        partnersByDay: Array<{ date: string; value: number }>;
        cardsByStatus: Array<{ key: string; value: number }>;
      }>('/admin/stats'),
    getPlatform: () => request<PlatformPayload>('/admin/platform'),
    savePlatform: (data: Record<string, unknown>) =>
      request<PlatformPayload>('/admin/platform', { method: 'PUT', body: JSON.stringify(data) }),
    testPlatformMail: (to: string) =>
      request<{ ok: boolean; error?: string }>('/admin/platform/mail-test', {
        method: 'POST',
        body: JSON.stringify({ to }),
      }),
    getSettings: () =>
      request<{
        wirex: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string };
        feePolicy?: Record<string, number | string | undefined>;
        security?: {
          otpRequiredAdmin?: boolean;
          otpRequiredMember?: boolean;
          otpRequiredOrg?: boolean;
        };
        useMockWirex: boolean;
        walletPolicy?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
        memberRegistration?: { mode?: 'open' | 'approval' };
        updatedAt?: string;
        _masked?: { clientSecret: string };
      }>('/admin/settings'),
    getPartners: () =>
      request<{
        items: Array<{
          id: string;
          name: string;
          companyName?: string;
          apiKeyPrefix: string;
          mid?: string;
          deliveryMode?: 'api' | 'sub_solution' | 'sub_solution_standalone';
          walletPolicySource?: 'follow_hq' | 'custom';
          walletModes?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
          canRedistributeKeys?: boolean;
          wirexConfigured?: boolean;
          solutionSlug?: string;
          solutionUrl?: string;
          credentials?: Record<string, unknown>;
          status: string;
          billingWalletAddress?: string;
          billingWarnings?: number;
          lastBillingMonth?: string;
          fees?: PartnerFeeFields;
          customFees?: boolean;
          feePolicyId?: string;
          feeSource?: string;
          feeTemplateName?: string;
          effectiveFees?: PartnerFeeFields;
          createdAt: string;
        }>;
        total: number;
      }>('/admin/partners'),
    createPartner: (data: Record<string, unknown>) =>
      request<{
        partner: { id: string; name: string; companyName?: string; status: string; createdAt: string };
        apiKey: string;
        kit?: CredentialKit;
        loginId?: string;
        orgCode?: string;
        warning: string;
      }>('/admin/partners', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePartner: (id: string, data: {
      name?: string;
      companyName?: string;
      status?: string;
      billingWalletAddress?: string;
      fees?: PartnerFeeFields;
      resetFees?: boolean;
      feePolicyId?: string;
      cardIssuePolicy?: string;
      allowVirtual?: boolean;
      allowPlastic?: boolean;
      distribution?: Record<string, number>;
      distributionApplyStart?: string;
      deliveryMode?: 'api' | 'sub_solution' | 'sub_solution_standalone';
      walletPolicySource?: 'follow_hq' | 'custom';
      walletModes?: { embedded?: boolean; externalEoa?: boolean; bridge?: boolean };
      webhookUrl?: string;
      solutionSlug?: string;
      solutionName?: string;
      bridgeDebitUrl?: string;
    }) =>
      request<{ id: string; name: string; companyName?: string; status: string; fees?: PartnerFeeFields; customFees?: boolean; effectiveFees?: PartnerFeeFields; updatedAt?: string }>(`/admin/partners/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    setPartnerBillingWallet: (id: string, billingWalletAddress: string) =>
      request<{ id: string; billingWalletAddress?: string }>(`/admin/partners/${id}/billing-wallet`, {
        method: 'PUT',
        body: JSON.stringify({ billingWalletAddress }),
      }),
    addPartnerBillingBalance: (id: string, amount: number) =>
      request<{ success: boolean; newBalance: number }>(`/admin/partners/${id}/add-billing-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    runPartnerBilling: () =>
      request<{ month: string; results: Array<{ partnerId: string; name: string; status: string; warning?: number }> }>('/admin/partners/run-billing', { method: 'POST' }),
    regeneratePartnerKey: (id: string) =>
      request<{ partner: { id: string; name: string; status: string }; apiKey: string; kit?: CredentialKit; warning: string }>(`/admin/partners/${id}/regenerate-key`, {
        method: 'POST',
      }),
    setStandaloneWirex: (id: string, data: { clientId: string; clientSecret: string; wirexPartnerId?: string }) =>
      request<{ id?: string; wirexConfigured: boolean; warning: string }>(`/admin/partners/${id}/standalone-wirex`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getOrg: (level?: string) =>
      request<{ items: Array<{ id: string; orgLevel: string; parentId?: string; parentName?: string; code: string; name: string; status: string; partnerId?: string; loginId?: string }>; total: number }>(
        `/admin/org${level ? `?level=${encodeURIComponent(level)}` : ''}`
      ),
    getOrgParents: (forLevel: string) =>
      request<{ items: Array<{ id: string; orgLevel: string; name: string; code: string }> }>(`/admin/org/parents?forLevel=${encodeURIComponent(forLevel)}`),
    createOrg: (data: Record<string, unknown>) =>
      request('/admin/org', { method: 'POST', body: JSON.stringify(data) }),
    checkLoginId: (email: string) =>
      request<{ available: boolean }>(`/admin/login-id-available?email=${encodeURIComponent(email)}`),
    searchPostcode: (country: string, q: string) =>
      request<{ items: Array<{ zip: string; address: string }> }>(
        `/admin/postcode?country=${encodeURIComponent(country)}&q=${encodeURIComponent(q)}`
      ),
    updateOrg: (id: string, data: { name?: string; status?: string; parentId?: string }) =>
      request(`/admin/org/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getSalesFeePolicy: () =>
      request<{
        cardIssuanceFee: number;
        cardTopUpFeePercent: number;
        cardUsageFeePerTransaction: number;
        cardMonthlyFee: number;
        partnerMonthlyFee: number;
        plasticIssuanceFee: number;
        distribution: Record<string, number>;
      }>('/admin/sales-fee-policy'),
    updateSalesFeePolicy: (data: Record<string, unknown>) =>
      request('/admin/sales-fee-policy', { method: 'PUT', body: JSON.stringify(data) }),
    getFeeTemplates: () =>
      request<{
        items: Array<{
          id: string;
          name: string;
          description?: string;
          isHqDefault: boolean;
          fees: PartnerFeeFields & { plasticIssuanceFee?: number };
          distribution: Record<string, number>;
        }>;
      }>('/admin/fee-templates'),
    createFeeTemplate: (data: Record<string, unknown>) =>
      request('/admin/fee-templates', { method: 'POST', body: JSON.stringify(data) }),
    updateFeeTemplate: (id: string, data: Record<string, unknown>) =>
      request(`/admin/fee-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFeeTemplate: (id: string) =>
      request(`/admin/fee-templates/${id}`, { method: 'DELETE' }),
    getCommissions: (partnerId?: string) =>
      request<{ items: unknown[]; total: number }>(`/admin/commissions${partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : ''}`),
    getBrand: () => request<BrandConfig>('/admin/brand'),
    updateBrand: (data: Partial<BrandConfig>) =>
      request<BrandConfig>('/admin/brand', { method: 'PUT', body: JSON.stringify(data) }),
    resetBrandColors: () =>
      request<BrandConfig>('/admin/brand/colors/reset', { method: 'POST', body: '{}' }),
    applyBrandDefaultColors: () =>
      request<BrandConfig>('/admin/brand/colors/apply-default', { method: 'POST', body: '{}' }),
    applyBrandColorPreset: (slot: number) =>
      request<BrandConfig>('/admin/brand/colors/apply-preset', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      }),
    saveBrandColorPreset: (slot: number, name?: string) =>
      request<BrandConfig>('/admin/brand/colors/save-preset', {
        method: 'POST',
        body: JSON.stringify({ slot, name }),
      }),
    sandboxStatus: () =>
      request<{
        environment: string;
        mock: boolean;
        apiBase: string;
        chainId: number;
        tokenOk?: boolean;
        tokenError?: string;
        clientIdSet?: boolean;
        partnerId?: string;
        webhookBaseUrl?: string;
        enabledLocales?: string[];
        note?: string;
      }>('/admin/sandbox/status'),
    sandboxSmoke: (data?: { email?: string }) =>
      request<{
        ok?: boolean;
        error?: string;
        steps: { step: string; ok: boolean; detail?: unknown }[];
        card?: unknown;
        userId?: string;
        wallet?: string;
        kycUrl?: string | null;
        onboarding?: { status?: string; error?: string | null; eoa?: string; smartWallet?: string };
      }>('/admin/sandbox/smoke', { method: 'POST', body: JSON.stringify(data ?? {}) }, 180000),
    updateSettings: (data: {
      wirex?: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string; environment?: 'sandbox' | 'production' };
      feePolicy?: { treasuryWalletAddress?: string; cardIssuanceFee?: number; cardTopUpFeePercent?: number; cardUsageFeePerTransaction?: number; cardMonthlyFee?: number; partnerMonthlyFee?: number };
      security?: {
        otpRequiredAdmin?: boolean;
        otpRequiredMember?: boolean;
        otpRequiredOrg?: boolean;
      };
      useMockWirex?: boolean;
      walletPolicy?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
      memberRegistration?: { mode?: 'open' | 'approval' };
    }) =>
      request<{
        wirex: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string };
        security?: {
          otpRequiredAdmin?: boolean;
          otpRequiredMember?: boolean;
          otpRequiredOrg?: boolean;
        };
        useMockWirex: boolean;
        updatedAt?: string;
      }>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
  kyc: {
    getVerificationLink: () =>
      request<{ url: string | null; message?: string }>('/kyc/verification-link'),
    status: () =>
      request<{ kycStatus: string; kycLevel?: string; capabilities?: string[]; mock?: boolean }>('/kyc/status'),
  },
  activities: {
    list: () => request<{ data?: unknown[]; items?: unknown[]; total?: number }>('/activities'),
  },
  reporting: {
    reconciliation: () =>
      request<{ entries: unknown[]; summary: unknown; note?: string }>('/reporting/reconciliation'),
    statement: () => request<unknown>('/reporting/statement'),
  },
  wallet: {
    getBalance: () => request<WalletBalance>('/wallet/balance'),
    p2p: (toUserId: string, amount: number) =>
      request<{ success: boolean; amount: number }>('/wallet/p2p', {
        method: 'POST',
        body: JSON.stringify({ toUserId, amount }),
      }),
    refund: (amount: number) =>
      request<{ success: boolean; amount: number; fee: number }>('/wallet/refund', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    getTransactions: (page?: number, size?: number) =>
      request<{ items: Transaction[]; total: number }>(`/wallet/transactions?page=${page ?? 1}&size=${size ?? 20}`),
    getCardUsage: (cardId: string, page?: number, size?: number) =>
      request<{ items: Transaction[]; total: number }>(`/wallet/card/${cardId}/usage?page=${page ?? 1}&size=${size ?? 20}`),
    getTokens: () => request<{ tokens: { symbol: string; name: string; decimals: number }[] }>('/wallet/tokens'),
    getCardDepositInfo: (cardId: string) =>
      request<{
        cardWalletAddress: string;
        currentBalance: number;
        currency: string;
        network: string;
        supportedTokens: { symbol: string; name: string; decimals: number }[];
        note: string;
      }>(`/wallet/card/${cardId}/deposit-info`),
    depositToCard: (cardId: string, amount: number, token?: string) =>
      request<{ success: boolean; newBalance: number }>(`/wallet/card/${cardId}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount, token: token || 'USDT' }),
      }),
  },
  partnerPortal: {
    login: (email: string, password: string, turnstileToken?: string) =>
      request<{
        token: string;
        otpRequired?: boolean;
        mustSetupOtp?: boolean;
        mustChangePassword?: boolean;
        operator: { id: string; email: string; name: string; role: string };
        partner: { id: string; name: string; companyName?: string };
      }>('/partner-portal/login', { method: 'POST', body: JSON.stringify({ email, password, turnstileToken }) }),
    verifyOtp: (code: string) => {
      const token = localStorage.getItem('partnerToken');
      return request<{ token: string; mustChangePassword?: boolean }>('/partner-portal/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    otpSetup: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{ secret: string; otpauthUrl: string; otpEnabled: boolean; otpRequired: boolean }>(
        '/partner-portal/otp/setup',
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
    },
    changePassword: (password: string) => {
      const token = localStorage.getItem('partnerToken');
      return request<{ ok: boolean }>('/partner-portal/password', {
        method: 'PUT',
        body: JSON.stringify({ password }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    overview: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{
        partner: { id: string; name: string; companyName?: string; status: string; cardIssuePolicy?: string; allowVirtual: boolean; allowPlastic: boolean };
        fees: {
          cardIssuanceFee: number;
          cardTopUpFeePercent: number;
          cardUsageFeePerTransaction: number;
          cardMonthlyFee: number;
          partnerMonthlyFee: number;
        };
        feeSource?: string;
        feeTemplateName?: string;
        apiBase: string;
        credentials?: {
          mid?: string;
          deliveryMode?: string;
          walletPolicySource?: 'follow_hq' | 'custom';
          walletModes?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
          canRedistributeKeys?: boolean;
          apiKeyPrefix?: string;
          hasApiSecret?: boolean;
          hasHmac?: boolean;
          webhookUrl?: string;
          solutionSlug?: string;
          solutionName?: string;
          solutionUrl?: string;
          bridgeDebitUrl?: string;
          endpoints?: Record<string, string>;
        };
        issuer?: string;
        note?: string;
      }>('/partner-portal/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    staff: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{
        items: Array<{ id: string; email: string; name: string; role: string; status: string; createdAt: string; groupId?: string; isSuper?: boolean; menuOverride?: string[] }>;
        total: number;
        canAdd: boolean;
        groups?: Array<{ id: string; code: string; name: string }>;
        catalog?: string[];
      }>('/partner-portal/staff', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    addStaff: (data: { email: string; name: string; password: string; role?: string; groupId?: string; menuOverride?: string[] }) => {
      const token = localStorage.getItem('partnerToken');
      return request('/partner-portal/staff', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    updateStaff: (id: string, data: { status?: string; role?: string; groupId?: string; menuOverride?: string[]; name?: string; password?: string }) => {
      const token = localStorage.getItem('partnerToken');
      return request(`/partner-portal/staff/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    me: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{ allowedMenus: string[]; deliveryMode?: string; canManageAccess?: boolean }>('/partner-portal/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    manuals: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{ items: Array<{ id: string; outlineKeys: string[]; ready: false }>; deliveryMode?: string; ready: boolean }>(
        '/partner-portal/manuals',
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
    },
    accessGroups: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{ items: Array<{ id: string; code: string; name: string; menus: string[]; builtIn?: boolean }>; catalog: string[] }>('/partner-portal/access/groups', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    createAccessGroup: (data: { name: string; menus?: string[] }) => {
      const token = localStorage.getItem('partnerToken');
      return request('/partner-portal/access/groups', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    updateAccessGroup: (id: string, data: { name?: string; menus?: string[] }) => {
      const token = localStorage.getItem('partnerToken');
      return request(`/partner-portal/access/groups/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    deleteAccessGroup: (id: string) => {
      const token = localStorage.getItem('partnerToken');
      return request(`/partner-portal/access/groups/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    },
    accessHistory: () => {
      const token = localStorage.getItem('partnerToken');
      return request<{ items: Array<{ id: string; at: string; actorEmail: string; action: string; detail: string }> }>(
        '/partner-portal/access/history',
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
    },
  },
};
