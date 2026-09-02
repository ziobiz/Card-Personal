import 'dotenv/config';
import { settingsStore } from './data/settingsStore.js';

/**
 * 공개 Sandbox 자격증명 (docs.wirexapp.com/docs/environments, 2026-04 갱신)
 * 전용 자격증명은 Wirex 온보딩 후 환경변수로 교체.
 */
const SANDBOX_CLIENT_ID = '3fCeoWq6FOtKJBZiyorXnxE41Dqp2zKB';
const SANDBOX_CLIENT_SECRET = '6FIY2GEQvdlgUEFHw4Dbii22_wCAqZ37lWV3TEMfTlkxrn8F5IbdgX9TiAvQUEsC';
const SANDBOX_PARTNER_ID = '0x00000000000000000000000000000044';
/** Base Sepolia WUSD */
const SANDBOX_WUSD = '0x0774164DC20524Bb239b39D1DC42573C3E4C6976';
const SANDBOX_WEUR = '0x5c55F314624718019A326F16a62A05D6C6d8C8A2';

export type WirexEnvironment = 'sandbox' | 'production';

export function getWirexEnvironment(): WirexEnvironment {
  const s = settingsStore.get().wirex?.environment;
  if (s === 'production' || s === 'sandbox') return s;
  const env = (process.env.WIREX_ENV ?? process.env.WIREX_ENVIRONMENT ?? 'sandbox').toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

export function getWirexBaaSConfig() {
  const environment = getWirexEnvironment();
  const s = settingsStore.get().wirex ?? {};
  const sandbox = {
    apiBase: 'https://api-baas.wirexapp.tech',
    helperBase: 'https://ramc.wirexapp.tech',
    pciBase: 'https://wx-acquiring-card-manager-uat.wirexapp.com',
    chainId: 84532,
  };
  const production = {
    apiBase: 'https://api-baas.wirexapp.com',
    helperBase: '',
    pciBase: 'https://wx-acquiring-card-manager.wirexapp.com',
    chainId: 8453,
  };
  const defaults = environment === 'production' ? production : sandbox;
  const env = {
    apiBase: process.env.WIREX_BAAS_URL ?? defaults.apiBase,
    helperBase: process.env.WIREX_HELPER_URL ?? defaults.helperBase,
    pciBase: process.env.WIREX_PCI_URL ?? defaults.pciBase,
    chainId: parseInt(process.env.WIREX_CHAIN_ID ?? String(defaults.chainId), 10),
    clientId: process.env.WIREX_CLIENT_ID || (environment === 'sandbox' ? SANDBOX_CLIENT_ID : ''),
    clientSecret: process.env.WIREX_CLIENT_SECRET || (environment === 'sandbox' ? SANDBOX_CLIENT_SECRET : ''),
    partnerId: process.env.WIREX_PARTNER_ID || SANDBOX_PARTNER_ID,
    wusdToken: process.env.WIREX_WUSD_TOKEN || SANDBOX_WUSD,
    weurToken: process.env.WIREX_WEUR_TOKEN || SANDBOX_WEUR,
  };
  return {
    environment,
    apiBase: s.apiBase ?? env.apiBase,
    helperBase: env.helperBase,
    pciBase: env.pciBase,
    chainId: s.chainId ?? env.chainId,
    clientId: (s.clientId || env.clientId) as string,
    clientSecret: (s.clientSecret || env.clientSecret) as string,
    partnerId: env.partnerId,
    wusdToken: env.wusdToken,
    weurToken: env.weurToken,
  };
}

export function getUseMockWirex(): boolean {
  const s = settingsStore.get().useMockWirex;
  if (typeof s === 'boolean') return s;
  return process.env.USE_MOCK_WIREX !== 'false';
}

export const wirexBaaS = {
  get apiBase() { return getWirexBaaSConfig().apiBase; },
  get chainId() { return getWirexBaaSConfig().chainId; },
  get clientId() { return getWirexBaaSConfig().clientId; },
  get clientSecret() { return getWirexBaaSConfig().clientSecret; },
};

export const config = {
  /** 로컬 기본 127.0.0.1 / 카페24 VPS 는 HOST=0.0.0.0 */
  host: process.env.HOST ?? '127.0.0.1',
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  get useMockWirex() { return getUseMockWirex(); },
  webhookSecret: process.env.WIREX_WEBHOOK_SECRET ?? '',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@icocard.local',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123',
  /** Crypto 기준 Google OTP. 기본 ON (false 로만 끔). 관리자 설정에서 덮어쓸 수 있음 */
  otpRequiredOrg: process.env.OTP_REQUIRED_ORG !== 'false',
  otpRequiredMember: process.env.OTP_REQUIRED_MEMBER !== 'false',
  otpRequiredAdmin: process.env.OTP_REQUIRED_ADMIN !== 'false',
  /** WebAuthn (Face ID / 지문) — 회원 모바일 2차 인증 */
  webauthnRpId: process.env.WEBAUTHN_RP_ID || 'localhost',
  webauthnRpName: process.env.WEBAUTHN_RP_NAME || 'ICOCARD',
  webauthnOrigin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
};
