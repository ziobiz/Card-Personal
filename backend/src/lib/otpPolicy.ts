import { config } from '../config.js';
import { settingsStore } from '../data/settingsStore.js';

export type SecuritySettings = {
  otpRequiredAdmin?: boolean;
  otpRequiredMember?: boolean;
  otpRequiredOrg?: boolean;
};

export function getSecuritySettings(): Required<SecuritySettings> {
  const s = settingsStore.get().security ?? {};
  return {
    otpRequiredAdmin: s.otpRequiredAdmin ?? config.otpRequiredAdmin,
    otpRequiredMember: s.otpRequiredMember ?? config.otpRequiredMember,
    otpRequiredOrg: s.otpRequiredOrg ?? config.otpRequiredOrg,
  };
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
