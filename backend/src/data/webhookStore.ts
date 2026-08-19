/**
 * Wirex 웹훅 수신 로그 (멱등성 키 포함)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config.js';

export interface WebhookEvent {
  id: string;
  path: string;
  payload: unknown;
  receivedAt: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'webhooks.json');

function load(): WebhookEvent[] {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8')).events ?? [];
  } catch {
    return [];
  }
}

function save(events: WebhookEvent[]): void {
  try {
    writeFileSync(FILE, JSON.stringify({ events: events.slice(-500) }, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save webhooks:', e);
  }
}

const events: WebhookEvent[] = load();

export function verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
  if (!config.webhookSecret) return true;
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
  const given = signatureHeader.replace(/^sha256=/i, '');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(given, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const webhookStore = {
  add(path: string, payload: unknown): WebhookEvent {
    const ev: WebhookEvent = {
      id: 'wh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      path,
      payload,
      receivedAt: new Date().toISOString(),
    };
    events.push(ev);
    save(events);
    return ev;
  },
  list(limit = 50): WebhookEvent[] {
    return events.slice(-limit).reverse();
  },
};
