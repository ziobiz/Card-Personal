/**
 * Daily server-usage samples for HQ 서버운영관리 charts.
 * One row per calendar day; payload() upserts today.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export type UsageSample = {
  date: string;
  memUsedPct: number;
  diskUsedPct: number;
  heapUsedPct: number;
  load1: number;
  trafficUsedGb: number | null;
};

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'server_usage.json');
const MAX_DAYS = 90;

function ymd(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function load(): UsageSample[] {
  if (!existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf-8')) as UsageSample[];
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.date === 'string') : [];
  } catch {
    return [];
  }
}

export function recordUsageSample(sample: Omit<UsageSample, 'date'>): UsageSample[] {
  const items = load();
  const date = ymd();
  const next: UsageSample = { date, ...sample };
  const idx = items.findIndex((r) => r.date === date);
  if (idx >= 0) items[idx] = next;
  else items.push(next);
  items.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = items.slice(-MAX_DAYS);
  writeFileSync(FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  return trimmed;
}
