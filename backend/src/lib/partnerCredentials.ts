/**
 * PG-style merchant credentials issued by US (not Wirex).
 * Pattern: ziobiz/PG 가맹점 API 생성 — MID + API Key + HMAC secret, 1회 표시, 재발급 시 폐기.
 */

import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';
import { config } from '../config.js';

export type DeliveryMode = 'api' | 'sub_solution' | 'sub_solution_standalone';

export function parseDeliveryMode(raw: unknown): DeliveryMode {
  if (raw === 'sub_solution' || raw === 'sub_solution_standalone') return raw;
  return 'api';
}

function encKey(): Buffer {
  return createHash('sha256').update(config.walletEncKey || config.jwtSecret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${enc.toString('hex')}`;
}

export function decryptSecret(blob: string): string {
  const [ivH, tagH, dataH] = blob.split('.');
  if (!ivH || !tagH || !dataH) throw new Error('Invalid secret blob');
  const decipher = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivH, 'hex'));
  decipher.setAuthTag(Buffer.from(tagH, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataH, 'hex')), decipher.final()]).toString('utf8');
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function secretsEqual(plain: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(plain), 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function newMid(): string {
  return 'MID' + randomBytes(5).toString('hex').toUpperCase();
}

export function newApiKey(live: boolean): string {
  return `${live ? 'pk_live_' : 'pk_test_'}${randomBytes(24).toString('hex')}`;
}

export function newApiSecret(live: boolean): string {
  return `${live ? 'sk_live_' : 'sk_test_'}${randomBytes(24).toString('hex')}`;
}

export function newHmacSecret(): string {
  return 'hmac_' + randomBytes(32).toString('hex');
}

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return s || 'partner';
}

export function hmacSign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function buildHmacPayload(method: string, path: string, timestamp: string, rawBody: string): string {
  const bodyHash = createHash('sha256').update(rawBody || '').digest('hex');
  return `${timestamp}.${method.toUpperCase()}.${path}.${bodyHash}`;
}

export function verifyHmac(opts: {
  secretPlain?: string;
  secretHash?: string;
  signature: string;
  method: string;
  path: string;
  timestamp: string;
  rawBody: string;
}): boolean {
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const payload = buildHmacPayload(opts.method, opts.path, opts.timestamp, opts.rawBody);
  if (opts.secretPlain) {
    const expected = hmacSign(opts.secretPlain, payload);
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(opts.signature).replace(/^sha256=/i, ''), 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
  return false;
}
