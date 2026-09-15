/**
 * HQ platform — domains, SSL path, SMTP, OTP flags overlay
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { settingsStore } from './settingsStore.js';

export interface PlatformConfig {
  primaryDomain: string;
  apiPublicUrl: string;
  corsOrigins: string[];
  sslCertPath: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  otpExpireMinutes: number;
  updatedAt?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'platform.json');

function defaults(): PlatformConfig {
  return {
    primaryDomain: 'icocard.net',
    apiPublicUrl: 'https://icocard.net',
    corsOrigins: ['https://icocard.net', 'https://www.icocard.net'],
    sslCertPath: '/etc/letsencrypt/live/icocard.net/fullchain.pem',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: 'noreply@icocard.net',
    otpExpireMinutes: 5,
  };
}

function load(): PlatformConfig {
  if (!existsSync(FILE)) return defaults();
  try {
    return { ...defaults(), ...JSON.parse(readFileSync(FILE, 'utf-8')) };
  } catch {
    return defaults();
  }
}

function save(cfg: PlatformConfig) {
  writeFileSync(FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

function readSslInfo(certPath?: string) {
  if (!certPath || !existsSync(certPath)) {
    return { status: 'N/A', detail: '인증서 파일 없음', daysRemaining: null as number | null, notAfter: null as string | null };
  }
  try {
    const pem = readFileSync(certPath, 'utf8');
    const out = execSync('openssl x509 -enddate -noout', { input: pem, encoding: 'utf8' }).trim();
    const match = out.match(/notAfter=(.+)/);
    if (!match) return { status: 'ERROR', detail: out, daysRemaining: null, notAfter: null };
    const notAfter = new Date(match[1]);
    const days = Math.ceil((notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return {
      status: days > 0 ? 'OK' : 'EXPIRED',
      detail: match[1],
      daysRemaining: days,
      notAfter: notAfter.toISOString(),
    };
  } catch (e) {
    return {
      status: 'ERROR',
      detail: e instanceof Error ? e.message : 'SSL read failed',
      daysRemaining: null,
      notAfter: null,
    };
  }
}

function pm2List(): unknown[] {
  try {
    return JSON.parse(execSync('pm2 jlist', { encoding: 'utf8' }) || '[]');
  } catch {
    return [];
  }
}

export const platformStore = {
  get(): PlatformConfig {
    return load();
  },

  update(patch: Partial<PlatformConfig>): PlatformConfig {
    const cur = load();
    const cleaned = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    ) as Partial<PlatformConfig>;
    const next: PlatformConfig = {
      ...cur,
      ...cleaned,
      corsOrigins: Array.isArray(patch.corsOrigins)
        ? patch.corsOrigins.map((s) => String(s).trim()).filter(Boolean)
        : cur.corsOrigins,
      smtpPort: patch.smtpPort != null ? Number(patch.smtpPort) || cur.smtpPort : cur.smtpPort,
      otpExpireMinutes:
        patch.otpExpireMinutes != null ? Number(patch.otpExpireMinutes) || cur.otpExpireMinutes : cur.otpExpireMinutes,
      smtpPassword:
        patch.smtpPassword && patch.smtpPassword !== '********' ? String(patch.smtpPassword) : cur.smtpPassword,
      updatedAt: new Date().toISOString(),
    };
    save(next);
    return next;
  },

  payload() {
    const config = load();
    const security = settingsStore.get().security ?? {};
    return {
      config: {
        ...config,
        smtpPassword: config.smtpPassword ? '********' : '',
      },
      security: {
        otpRequiredAdmin: security.otpRequiredAdmin !== false,
        otpRequiredMember: security.otpRequiredMember !== false,
        otpRequiredOrg: security.otpRequiredOrg !== false,
      },
      ssl: readSslInfo(config.sslCertPath),
      server: {
        hostname: os.hostname(),
        uptimeSec: os.uptime(),
        memTotalMb: Math.round(os.totalmem() / 1024 / 1024),
        memFreeMb: Math.round(os.freemem() / 1024 / 1024),
        loadAvg: os.loadavg(),
      },
      pm2: pm2List(),
    };
  },
};
