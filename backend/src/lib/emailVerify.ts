import { createHash, randomInt } from 'crypto';
import { config } from '../config.js';
import { store, type AppUser } from '../data/store.js';
import { platformStore } from '../data/platformStore.js';
import { sendMemberMail } from './mailer.js';

export type EmailPurpose = 'register' | 'reset' | 'change_password';

function hashCode(code: string) {
  return createHash('sha256').update(`email-code:${code}:${config.jwtSecret}`).digest('hex');
}

export function isEmailVerified(user: AppUser): boolean {
  return user.emailVerified !== false;
}

export function makeEmailCode(): string {
  return String(randomInt(100000, 1000000));
}

export async function issueEmailCode(
  user: AppUser,
  purpose: EmailPurpose,
  opts?: { force?: boolean }
): Promise<{ ok: true; resent: boolean } | { ok: false; code: 'too_soon' }> {
  const minutes = Math.max(3, platformStore.get().otpExpireMinutes || 10);
  const prev = user.emailVerify;
  if (!opts?.force && prev?.sentAt && prev.purpose === purpose) {
    const elapsed = Date.now() - new Date(prev.sentAt).getTime();
    if (elapsed < 45_000) return { ok: false, code: 'too_soon' };
  }
  const code = makeEmailCode();
  user.emailVerify = {
    purpose,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    sentAt: new Date().toISOString(),
    attempts: 0,
  };
  store.save();
  const subject =
    purpose === 'register'
      ? `[ICOCARD] 이메일 인증번호 ${code}`
      : `[ICOCARD] 비밀번호 확인 인증번호 ${code}`;
  const action =
    purpose === 'register' ? '회원가입 이메일 확인' : '비밀번호 재설정/변경';
  const text = [
    `${user.displayName || user.email} 님,`,
    '',
    `${action}을 위한 인증번호입니다.`,
    '',
    `인증번호: ${code}`,
    `유효시간: ${minutes}분`,
    '',
    '본인이 요청하지 않았다면 이 메일을 무시하세요.',
  ].join('\n');
  const sent = await sendMemberMail(user.email, subject, text);
  if (!sent.sent) {
    console.warn(`[email-verify] mail not sent (${sent.reason}) ${user.email} ${purpose} code=${code}`);
  }
  return { ok: true, resent: Boolean(prev) };
}

export function consumeEmailCode(
  user: AppUser,
  purpose: EmailPurpose,
  raw: string
): 'ok' | 'expired' | 'mismatch' | 'locked' | 'missing' {
  const ev = user.emailVerify;
  if (!ev || ev.purpose !== purpose) return 'missing';
  if (new Date(ev.expiresAt).getTime() < Date.now()) return 'expired';
  ev.attempts = (ev.attempts || 0) + 1;
  if (ev.attempts > 8) {
    store.save();
    return 'locked';
  }
  const code = String(raw || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6 || ev.codeHash !== hashCode(code)) {
    store.save();
    return 'mismatch';
  }
  user.emailVerify = undefined;
  if (purpose === 'register') user.emailVerified = true;
  store.save();
  return 'ok';
}
