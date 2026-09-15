import { config } from '../config.js';

type TurnstileResult = { success: boolean; errorCodes?: string[] };

export function turnstileEnabled(): boolean {
  return Boolean(config.turnstileSecretKey && config.turnstileSiteKey);
}

export async function verifyTurnstileToken(
  token: unknown,
  remoteip?: string
): Promise<TurnstileResult> {
  if (!turnstileEnabled()) return { success: true };
  const response = String(token || '').trim();
  if (!response) return { success: false, errorCodes: ['missing-input-response'] };

  const body = new URLSearchParams();
  body.set('secret', config.turnstileSecretKey);
  body.set('response', response);
  if (remoteip) body.set('remoteip', remoteip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    return {
      success: Boolean(data.success),
      errorCodes: data['error-codes'],
    };
  } catch {
    return { success: false, errorCodes: ['internal-error'] };
  }
}

export async function requireTurnstile(req: { body?: unknown; ip?: string }, res: {
  status: (n: number) => { json: (b: unknown) => unknown };
}): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  const body = (req.body || {}) as { turnstileToken?: string; cfTurnstileResponse?: string };
  const token = body.turnstileToken || body.cfTurnstileResponse;
  const result = await verifyTurnstileToken(token, req.ip);
  if (!result.success) {
    res.status(403).json({ error: 'Turnstile verification failed', codes: result.errorCodes });
    return false;
  }
  return true;
}
