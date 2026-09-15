const CODE_KEYS: Record<string, string> = {
  not_registered: 'auth.notRegistered',
  bad_password: 'auth.badPassword',
  pending_approval: 'auth.pendingApproval',
  account_suspended: 'auth.accountSuspended',
  account_rejected: 'auth.accountRejected',
  email_taken: 'auth.emailTaken',
  weak_password: 'auth.weakPassword',
  missing_fields: 'auth.missingFields',
  tenant_mismatch: 'auth.tenantMismatch',
  tenant_not_found: 'auth.tenantNotFound',
};

export function authErrorI18nKey(err: unknown): string | null {
  const e = err as { code?: string; body?: { code?: string; error?: string }; message?: string };
  const code = e.code || e.body?.code || '';
  if (code && CODE_KEYS[code]) return CODE_KEYS[code];
  const msg = e.message || e.body?.error || '';
  if (CODE_KEYS[msg]) return CODE_KEYS[msg];
  return null;
}
