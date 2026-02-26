import 'dotenv/config';
import { settingsStore } from './data/settingsStore.js';

/** Sandbox 공개 자격증명 (설정에 값이 없을 때 테스트용) */
const SANDBOX_CLIENT_ID = '9qgK7xzQirmJgZi9zOamLXQ6dQ7KpUu9';
const SANDBOX_CLIENT_SECRET = 'BaVKTFYdYdk5urr9fuzRHKEZ3BC-pvhyANaOfDN10r_mW-MTaZ_v4tTA1IFzav6I';

/** 환경변수 → 설정 저장소 순으로 적용. 설정 저장소 값이 우선 */
export function getWirexBaaSConfig() {
  const s = settingsStore.get().wirex ?? {};
  const env = {
    apiBase: process.env.WIREX_BAAS_URL ?? 'https://api-baas.wirexapp.tech',
    chainId: parseInt(process.env.WIREX_CHAIN_ID ?? '84532', 10),
    clientId: process.env.WIREX_CLIENT_ID || SANDBOX_CLIENT_ID,
    clientSecret: process.env.WIREX_CLIENT_SECRET || SANDBOX_CLIENT_SECRET,
  };
  return {
    apiBase: s.apiBase ?? env.apiBase,
    chainId: s.chainId ?? env.chainId,
    clientId: (s.clientId || env.clientId) as string,
    clientSecret: (s.clientSecret || env.clientSecret) as string,
  };
}

/** Mock 사용 여부 - 설정 저장소 우선 */
export function getUseMockWirex(): boolean {
  const s = settingsStore.get().useMockWirex;
  if (typeof s === 'boolean') return s;
  return process.env.USE_MOCK_WIREX !== 'false';
}

/** 기존 호환용 (wirexBaaSClient는 getWirexBaaSConfig 사용) */
export const wirexBaaS = {
  get apiBase() { return getWirexBaaSConfig().apiBase; },
  get chainId() { return getWirexBaaSConfig().chainId; },
  get clientId() { return getWirexBaaSConfig().clientId; },
  get clientSecret() { return getWirexBaaSConfig().clientSecret; },
};

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  get useMockWirex() { return getUseMockWirex(); },
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@wirexcard.local',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123',
};
