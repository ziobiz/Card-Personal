/**
 * 관리자 환경설정 저장소
 * JSON 파일로 영구 저장 - Wirex API 등 연동 설정
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface WirexSettings {
  apiBase?: string;
  chainId?: number;
  clientId?: string;
  clientSecret?: string;
}

export interface FeePolicySettings {
  treasuryWalletAddress?: string;
  cardIssuanceFee?: number;
  cardTopUpFeePercent?: number;
  cardUsageFeePerTransaction?: number;
  cardMonthlyFee?: number;
  partnerMonthlyFee?: number;
}

export interface AdminSettings {
  wirex?: WirexSettings;
  useMockWirex?: boolean;
  feePolicy?: FeePolicySettings;
  updatedAt?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dirname, 'settings.json');

const DEFAULTS: AdminSettings = {
  wirex: {
    apiBase: 'https://api-baas.wirexapp.tech',
    chainId: 84532,
    clientId: '',
    clientSecret: '',
  },
  useMockWirex: true,
  feePolicy: {
    treasuryWalletAddress: '',
    cardIssuanceFee: 5,
    cardTopUpFeePercent: 0.5,
    cardUsageFeePerTransaction: 0.1,
    cardMonthlyFee: 2,
    partnerMonthlyFee: 50,
  },
};

function loadFromFile(): AdminSettings {
  if (!existsSync(SETTINGS_FILE)) return { ...DEFAULTS };
  try {
    const data = readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      ...DEFAULTS,
      ...parsed,
      wirex: { ...DEFAULTS.wirex, ...parsed.wirex },
      feePolicy: { ...DEFAULTS.feePolicy, ...parsed.feePolicy },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveToFile(settings: AdminSettings): void {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

let cached: AdminSettings = loadFromFile();

export const settingsStore = {
  get(): AdminSettings {
    return { ...cached };
  },

  update(partial: Partial<AdminSettings>): AdminSettings {
    cached = {
      ...cached,
      ...partial,
      wirex: { ...cached.wirex, ...partial.wirex },
      feePolicy: { ...cached.feePolicy, ...partial.feePolicy },
      updatedAt: new Date().toISOString(),
    };
    saveToFile(cached);
    return this.get();
  },

  reload(): void {
    cached = loadFromFile();
  },
};
