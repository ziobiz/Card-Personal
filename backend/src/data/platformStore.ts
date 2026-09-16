/**
 * HQ platform — domains, SSL, SMTP, hosting contract, live server health (PG 서버운영관리).
 */

import { existsSync, readFileSync, readdirSync, statfsSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { X509Certificate } from 'crypto';
import os from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { settingsStore } from './settingsStore.js';
import { recordUsageSample } from './serverMetricsStore.js';

export type HealthLevel = 'ok' | 'warn' | 'danger';

export interface PlatformConfig {
  primaryDomain: string;
  apiPublicUrl: string;
  corsOrigins: string[];
  sslCertPath: string;
  sslLeDomain: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpFromName: string;
  otpExpireMinutes: number;
  uiRefreshSec: number;
  nginxStubStatusUrl: string;
  contractDiskGb: number | null;
  contractTrafficGb: number | null;
  trafficUsedGb: number | null;
  contractStart: string;
  contractEnd: string;
  updatedAt?: string;
}

type HealthRow = {
  id: string;
  status: HealthLevel;
  labelKey: string;
  value: string;
  criteria: string;
  pct: number | null;
};

type HealthAlert = { key: string; args: unknown[]; level: HealthLevel };

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'platform.json');

const SYS_MEM_WARN = 70;
const SYS_MEM_DANGER = 90;
const HEAP_WARN = 80;
const HEAP_DANGER = 92;
const DISK_WARN = 75;
const DISK_DANGER = 90;
const LOAD_MULT = 2;
const SSL_WARN = 30;
const SSL_DANGER = 14;

function defaults(): PlatformConfig {
  return {
    primaryDomain: 'icocard.net',
    apiPublicUrl: 'https://icocard.net',
    corsOrigins: ['https://icocard.net', 'https://www.icocard.net'],
    sslCertPath: '/etc/letsencrypt/live/icocard.net/fullchain.pem',
    sslLeDomain: 'icocard.net',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: 'noreply@icocard.net',
    smtpFromName: 'ICOCARD',
    otpExpireMinutes: 5,
    uiRefreshSec: 120,
    nginxStubStatusUrl: '',
    contractDiskGb: null,
    contractTrafficGb: null,
    trafficUsedGb: null,
    contractStart: '',
    contractEnd: '',
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

function clampRefresh(sec: number | null | undefined, fallback = 120): number {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 15) return Math.min(3600, Math.max(15, fallback));
  return Math.max(15, Math.min(3600, Math.round(n)));
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function hostFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  let t = String(url).trim();
  if (!t) return null;
  try {
    if (!t.includes('://')) t = `https://${t}`;
    const h = new URL(t).hostname;
    return h || null;
  } catch {
    return null;
  }
}

function resolvePemPath(cfg: PlatformConfig): string | null {
  const candidates = [
    cfg.sslCertPath,
    process.env.ICOCARD_SSL_CERT_PATH,
    process.env.SSL_CERT_PATH,
    cfg.sslLeDomain ? `/etc/letsencrypt/live/${cfg.sslLeDomain.trim()}/fullchain.pem` : '',
    cfg.primaryDomain ? `/etc/letsencrypt/live/${cfg.primaryDomain.trim()}/fullchain.pem` : '',
  ];
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return cfg.sslCertPath || null;
}

function parseSan(alt: string | undefined): string[] {
  if (!alt) return [];
  const names: string[] = [];
  for (const part of alt.split(',')) {
    const s = part.trim();
    const m = s.match(/^(?:DNS|dns):(.+)$/i);
    if (m) names.push(m[1].trim().toLowerCase());
  }
  return [...new Set(names)].sort();
}

function readSslInfo(pemPath: string | null) {
  const empty = {
    status: 'N/A',
    detail: '인증서 파일을 찾을 수 없습니다. SSL 경로 또는 Let\'s Encrypt live 폴더명(예: icocard.net)을 저장하세요.',
    daysRemaining: null as number | null,
    notAfter: null as string | null,
    notBefore: null as string | null,
    subjectDn: '',
    issuerDn: '',
    fingerprintSha256: '',
    sanDnsNames: [] as string[],
    leLiveCertName: '',
    resolvedPath: pemPath || '',
  };
  if (!pemPath || !existsSync(pemPath)) return empty;
  try {
    const pem = readFileSync(pemPath, 'utf8');
    const cert = new X509Certificate(pem);
    const notAfter = new Date(cert.validTo);
    const days = Math.ceil((notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const parent = pemPath.replace(/\\/g, '/').split('/').slice(-2, -1)[0] || '';
    let status = 'OK';
    if (days <= 0) status = 'EXPIRED';
    return {
      status,
      detail: cert.validTo,
      daysRemaining: days,
      notAfter: notAfter.toISOString(),
      notBefore: new Date(cert.validFrom).toISOString(),
      subjectDn: cert.subject,
      issuerDn: cert.issuer,
      fingerprintSha256: (cert.fingerprint256 || '').replace(/:/g, '').toLowerCase(),
      sanDnsNames: parseSan(cert.subjectAltName),
      leLiveCertName: parent,
      resolvedPath: pemPath,
    };
  } catch (e) {
    return {
      ...empty,
      status: 'ERROR',
      detail: e instanceof Error ? e.message : 'SSL read failed',
      resolvedPath: pemPath,
    };
  }
}

function readDiskInfo() {
  try {
    const pathRoot = process.cwd();
    const st = statfsSync(pathRoot);
    const bsize = Number(st.bsize || 0);
    const total = bsize * Number(st.blocks || 0);
    const usable = bsize * Number(st.bavail || st.bfree || 0);
    const used = Math.max(0, total - usable);
    const usedPct = total > 0 ? Math.round((used * 1000) / total) / 10 : 0;
    return { ok: true, pathRoot, totalBytes: total, usableBytes: usable, usedBytes: used, usedPct };
  } catch (e) {
    return {
      ok: false,
      pathRoot: process.cwd(),
      totalBytes: 0,
      usableBytes: 0,
      usedBytes: 0,
      usedPct: 0,
      error: e instanceof Error ? e.message : 'disk',
    };
  }
}

function fmtGb(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 GB';
  return `${(Math.round(n * 100) / 100).toFixed(2)} GB`;
}

function bytesToGb(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function worstOf(rows: HealthRow[]): HealthLevel {
  if (rows.some((r) => r.status === 'danger')) return 'danger';
  if (rows.some((r) => r.status === 'warn')) return 'warn';
  return 'ok';
}

function buildHealth(
  host: { memoryTotalMb: number; memoryAvailableMb: number },
  proc: { heapUsedPct: number; heapUsedMb: number; heapMaxMb: number; cpuCount: number; load1: number | null },
  disk: ReturnType<typeof readDiskInfo>,
  ssl: ReturnType<typeof readSslInfo>,
  cfg: PlatformConfig
): { alerts: HealthAlert[]; rows: HealthRow[]; worstStatus: HealthLevel } {
  const alerts: HealthAlert[] = [];
  const rows: HealthRow[] = [];

  if (cfg.contractEnd) {
    const end = new Date(`${cfg.contractEnd}T00:00:00Z`);
    if (!Number.isNaN(end.getTime())) {
      const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
      if (days < 0) alerts.push({ key: 'hostingExpired', args: [cfg.contractEnd], level: 'danger' });
      else if (days <= 14) alerts.push({ key: 'hostingSoon', args: [days], level: 'warn' });
    }
  }

  const totalMb = host.memoryTotalMb;
  const availMb = host.memoryAvailableMb;
  const sysMemPct = totalMb > 0 ? round1(((totalMb - availMb) * 100) / totalMb) : 0;
  const sysStatus: HealthLevel = sysMemPct >= SYS_MEM_DANGER ? 'danger' : sysMemPct >= SYS_MEM_WARN ? 'warn' : 'ok';
  if (sysMemPct >= SYS_MEM_DANGER) alerts.push({ key: 'sysMem', args: [SYS_MEM_DANGER], level: 'danger' });
  rows.push({
    id: 'sys_mem',
    status: sysStatus,
    labelKey: 'sysMem',
    value: `${sysMemPct}% · ${availMb} / ${totalMb} MB`,
    criteria: `주의 ≥${SYS_MEM_WARN}% · 위험 ≥${SYS_MEM_DANGER}%`,
    pct: sysMemPct,
  });

  const heapPct = proc.heapUsedPct;
  const heapStatus: HealthLevel = heapPct >= HEAP_DANGER ? 'danger' : heapPct >= HEAP_WARN ? 'warn' : 'ok';
  if (heapPct >= HEAP_DANGER) alerts.push({ key: 'nodeHeap', args: [HEAP_DANGER], level: 'danger' });
  rows.push({
    id: 'node_heap',
    status: heapStatus,
    labelKey: 'nodeHeap',
    value: `${proc.heapUsedMb} / ${proc.heapMaxMb} MB (${heapPct}%)`,
    criteria: `주의 ≥${HEAP_WARN}% · 위험 ≥${HEAP_DANGER}%`,
    pct: heapPct,
  });

  const load = proc.load1;
  const cpuN = Math.max(1, proc.cpuCount);
  const loadDanger = load != null && load >= 0 && load > cpuN * LOAD_MULT;
  const loadStatus: HealthLevel =
    load == null || load < 0 ? 'ok' : loadDanger ? 'danger' : load > cpuN ? 'warn' : 'ok';
  if (loadDanger) alerts.push({ key: 'load', args: [LOAD_MULT], level: 'danger' });
  rows.push({
    id: 'load_avg',
    status: loadStatus,
    labelKey: 'loadAvg',
    value: load == null || load < 0 ? '—' : String(load),
    criteria: `CPU ${cpuN} · 주의 >${cpuN} · 위험 >${cpuN * LOAD_MULT}`,
    pct: load != null && load >= 0 ? round1((load / cpuN) * 50) : null,
  });

  let diskStatus: HealthLevel = 'ok';
  let diskVal = '—';
  let diskPct: number | null = null;
  if (disk.ok) {
    diskPct = disk.usedPct;
    diskVal = `${disk.usedPct}%`;
    diskStatus = disk.usedPct >= DISK_DANGER ? 'danger' : disk.usedPct >= DISK_WARN ? 'warn' : 'ok';
    if (disk.usedPct >= DISK_DANGER) alerts.push({ key: 'disk', args: [DISK_DANGER], level: 'danger' });
  } else {
    diskStatus = 'warn';
  }
  rows.push({
    id: 'disk',
    status: diskStatus,
    labelKey: 'disk',
    value: diskVal,
    criteria: `주의 ≥${DISK_WARN}% · 위험 ≥${DISK_DANGER}%`,
    pct: diskPct,
  });

  let sslStatus: HealthLevel = 'ok';
  let sslVal = '—';
  if (ssl.status === 'OK' || ssl.status === 'EXPIRED') {
    const days = ssl.daysRemaining ?? 0;
    sslVal = `${days}일`;
    sslStatus = days < SSL_DANGER ? 'danger' : days < SSL_WARN ? 'warn' : 'ok';
    if (days < SSL_DANGER) alerts.push({ key: 'sslDanger', args: [SSL_DANGER], level: 'danger' });
    else if (days < SSL_WARN) alerts.push({ key: 'sslWarn', args: [SSL_WARN], level: 'warn' });
  } else if (ssl.status === 'N/A') {
    sslStatus = 'warn';
    sslVal = 'N/A';
  } else {
    sslStatus = 'danger';
    sslVal = ssl.detail || 'ERROR';
    alerts.push({ key: 'sslRead', args: [], level: 'danger' });
  }
  rows.push({
    id: 'ssl',
    status: sslStatus,
    labelKey: 'ssl',
    value: sslVal,
    criteria: `주의 <${SSL_WARN}일 · 위험 <${SSL_DANGER}일`,
  pct: ssl.daysRemaining != null ? Math.max(0, Math.min(100, (ssl.daysRemaining / 90) * 100)) : null,
  });

  if (cfg.contractDiskGb && cfg.contractDiskGb > 0 && disk.ok) {
    const usedGb = bytesToGb(disk.usedBytes);
    const pct = round1((usedGb * 100) / cfg.contractDiskGb);
    const st: HealthLevel = pct >= DISK_DANGER ? 'danger' : pct >= DISK_WARN ? 'warn' : 'ok';
    if (pct >= DISK_DANGER) alerts.push({ key: 'contractDisk', args: [fmtGb(cfg.contractDiskGb), DISK_DANGER], level: 'danger' });
    rows.push({
      id: 'contract_disk',
      status: st,
      labelKey: 'contractDisk',
      value: `${fmtGb(usedGb)} / ${fmtGb(cfg.contractDiskGb)} (${pct}%)`,
      criteria: `약정 ${fmtGb(cfg.contractDiskGb)} · 주의 ≥${DISK_WARN}% · 위험 ≥${DISK_DANGER}%`,
      pct,
    });
  }

  if (cfg.contractTrafficGb && cfg.contractTrafficGb > 0) {
    if (cfg.trafficUsedGb == null) {
      rows.push({
        id: 'contract_traffic',
        status: 'warn',
        labelKey: 'contractTraffic',
        value: '사용량 미입력 (호스팅 패널 값 저장)',
        criteria: `약정 ${fmtGb(cfg.contractTrafficGb)} · 주의 ≥${DISK_WARN}% · 위험 ≥${DISK_DANGER}%`,
        pct: null,
      });
    } else {
      const pct = round1((cfg.trafficUsedGb * 100) / cfg.contractTrafficGb);
      const st: HealthLevel = pct >= DISK_DANGER ? 'danger' : pct >= DISK_WARN ? 'warn' : 'ok';
      if (pct >= DISK_DANGER)
        alerts.push({ key: 'contractTraffic', args: [fmtGb(cfg.contractTrafficGb), DISK_DANGER], level: 'danger' });
      rows.push({
        id: 'contract_traffic',
        status: st,
        labelKey: 'contractTraffic',
        value: `${fmtGb(cfg.trafficUsedGb)} / ${fmtGb(cfg.contractTrafficGb)} (${pct}%)`,
        criteria: `약정 ${fmtGb(cfg.contractTrafficGb)} · 주의 ≥${DISK_WARN}% · 위험 ≥${DISK_DANGER}%`,
        pct,
      });
    }
  }

  return { alerts, rows, worstStatus: worstOf(rows) };
}

function readCertbotInfo() {
  const renewalDir = '/etc/letsencrypt/renewal';
  let renewalConfFiles: string[] = [];
  try {
    if (existsSync(renewalDir)) {
      renewalConfFiles = readdirSync(renewalDir)
        .filter((f) => f.endsWith('.conf'))
        .sort();
    }
  } catch {
    /* ignore */
  }
  const win = os.platform() === 'win32';
  let timerActive = win ? 'N/A' : '';
  let timerNext = win ? 'N/A' : '';
  if (!win) {
    try {
        timerActive = execSync('systemctl is-active certbot.timer', {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
    } catch {
      timerActive = 'inactive';
    }
    try {
      timerNext = execSync('systemctl show certbot.timer -p NextElapseUSecRealtime --value', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch {
      timerNext = '';
    }
  }
  return { renewalConfFiles, timerActive, timerNext };
}

async function readNginxStub(url: string) {
  if (!url.trim()) return { configured: false, ok: false as boolean };
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2500);
    const r = await fetch(url.trim(), { signal: ac.signal });
    clearTimeout(timer);
    const text = await r.text();
    const active = Number((text.match(/Active connections:\s+(\d+)/i) || [])[1]);
    const rw = text.match(/Reading:\s+(\d+)\s+Writing:\s+(\d+)\s+Waiting:\s+(\d+)/i);
    return {
      configured: true,
      ok: r.ok,
      active: Number.isFinite(active) ? active : undefined,
      reading: rw ? Number(rw[1]) : undefined,
      writing: rw ? Number(rw[2]) : undefined,
      waiting: rw ? Number(rw[3]) : undefined,
      raw: text.slice(0, 400),
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      error: e instanceof Error ? e.message : 'nginx stub failed',
    };
  }
}

function pm2List(): Array<{
  name: string;
  status: string;
  cpu: number;
  memoryMb: number;
  uptimeMs: number;
  restarts: number;
}> {
  try {
    const raw = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '[]') as Array<{
      name?: string;
      pm2_env?: { status?: string; pm_uptime?: number; restart_time?: number };
      monit?: { memory?: number; cpu?: number };
    }>;
    return raw.map((p) => ({
      name: p.name || '-',
      status: p.pm2_env?.status || '-',
      cpu: p.monit?.cpu ?? 0,
      memoryMb: Math.round((p.monit?.memory || 0) / (1024 * 1024)),
      uptimeMs: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
      restarts: p.pm2_env?.restart_time ?? 0,
    }));
  } catch {
    return [];
  }
}

function buildLinkage(cfg: PlatformConfig, san: string[]) {
  const sanLower = new Set(san.map((s) => s.toLowerCase()));
  const sources: Array<{ hostname: string; source: string }> = [];
  const add = (url: string | undefined, source: string) => {
    const h = hostFromUrl(url);
    if (h) sources.push({ hostname: h, source });
  };
  add(cfg.primaryDomain, 'PRIMARY_DOMAIN');
  add(cfg.apiPublicUrl, 'PUBLIC_API');
  for (const o of cfg.corsOrigins) add(o, 'CORS');
  const rows = sources.map((s) => ({
    ...s,
    inCertificate: sanLower.has(s.hostname.toLowerCase()),
  }));
  const missing = rows.filter((r) => !r.inCertificate).map((r) => r.hostname);
  const referred = new Set(rows.map((r) => r.hostname.toLowerCase()));
  const sanOnly = san.filter((s) => !referred.has(s.toLowerCase()));
  return { sanDnsNames: san, rows, missing, sanOnly };
}

export const platformStore = {
  get(): PlatformConfig {
    return load();
  },

  update(patch: Partial<PlatformConfig>): PlatformConfig {
    const cur = load();
    const next: PlatformConfig = {
      ...cur,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      corsOrigins: Array.isArray(patch.corsOrigins)
        ? patch.corsOrigins.map((s) => String(s).trim()).filter(Boolean)
        : cur.corsOrigins,
      smtpPort: patch.smtpPort != null ? Number(patch.smtpPort) || cur.smtpPort : cur.smtpPort,
      otpExpireMinutes:
        patch.otpExpireMinutes != null ? Number(patch.otpExpireMinutes) || cur.otpExpireMinutes : cur.otpExpireMinutes,
      uiRefreshSec:
        patch.uiRefreshSec != null ? clampRefresh(Number(patch.uiRefreshSec), cur.uiRefreshSec) : cur.uiRefreshSec,
      smtpPassword:
        patch.smtpPassword && patch.smtpPassword !== '********' ? String(patch.smtpPassword) : cur.smtpPassword,
      smtpSecure: typeof patch.smtpSecure === 'boolean' ? patch.smtpSecure : cur.smtpSecure,
      contractDiskGb: patch.contractDiskGb !== undefined ? numOrNull(patch.contractDiskGb) : cur.contractDiskGb,
      contractTrafficGb:
        patch.contractTrafficGb !== undefined ? numOrNull(patch.contractTrafficGb) : cur.contractTrafficGb,
      trafficUsedGb: patch.trafficUsedGb !== undefined ? numOrNull(patch.trafficUsedGb) : cur.trafficUsedGb,
      contractStart: patch.contractStart !== undefined ? String(patch.contractStart || '') : cur.contractStart,
      contractEnd: patch.contractEnd !== undefined ? String(patch.contractEnd || '') : cur.contractEnd,
      updatedAt: new Date().toISOString(),
    };
    save(next);
    return next;
  },

  async payload() {
    const config = load();
    const security = settingsStore.get().security ?? {};
    const pemPath = resolvePemPath(config);
    const ssl = readSslInfo(pemPath);
    const disk = readDiskInfo();
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapMaxMb = Math.round(mem.heapTotal / 1024 / 1024);
    const heapUsedPct = heapMaxMb > 0 ? round1((heapUsedMb * 100) / heapMaxMb) : 0;
    const cpuCount = Math.max(1, os.cpus().length);
    const loadAvg = os.loadavg();
    const host = {
      hostname: os.hostname(),
      osFamily: os.type(),
      osVersion: os.release(),
      arch: os.arch(),
      memoryTotalMb: Math.round(os.totalmem() / 1024 / 1024),
      memoryAvailableMb: Math.round(os.freemem() / 1024 / 1024),
      cpuCount,
      uptimeSec: Math.round(os.uptime()),
      loadAvg,
    };
    const proc = {
      nodeVersion: process.version,
      heapUsedMb,
      heapMaxMb,
      heapUsedPct,
      rssMb: Math.round(mem.rss / 1024 / 1024),
      cpuCount,
      load1: loadAvg[0] ?? null,
      uptimeMs: Math.round(process.uptime() * 1000),
    };
    const health = buildHealth(host, proc, disk, ssl, config);
    const metrics = recordUsageSample({
      memUsedPct:
        host.memoryTotalMb > 0
          ? round1(((host.memoryTotalMb - host.memoryAvailableMb) * 100) / host.memoryTotalMb)
          : 0,
      diskUsedPct: disk.usedPct,
      heapUsedPct,
      load1: loadAvg[0] ?? 0,
      trafficUsedGb: config.trafficUsedGb,
    });
    const nginxStub = await readNginxStub(config.nginxStubStatusUrl);
    const refresh = clampRefresh(config.uiRefreshSec);
    return {
      generatedAt: new Date().toISOString(),
      uiAutoRefreshSeconds: refresh,
      config: {
        ...config,
        smtpPassword: config.smtpPassword ? '********' : '',
      },
      security: {
        otpRequiredAdmin: security.otpRequiredAdmin !== false,
        otpRequiredMember: security.otpRequiredMember !== false,
        otpRequiredOrg: security.otpRequiredOrg !== false,
      },
      ssl,
      host,
      process: proc,
      disk,
      health,
      certbot: readCertbotInfo(),
      nginxStub,
      linkage: buildLinkage(config, ssl.sanDnsNames),
      contract: {
        diskGb: config.contractDiskGb,
        trafficGb: config.contractTrafficGb,
        trafficUsedGb: config.trafficUsedGb,
        periodStart: config.contractStart,
        periodEnd: config.contractEnd,
      },
      pm2: pm2List(),
      metrics,
      sslOpsGuide: {
        dns: 'dns',
        leSan: 'leSan',
        cloudflare: 'cloudflare',
      },
      server: {
        hostname: host.hostname,
        uptimeSec: host.uptimeSec,
        memTotalMb: host.memoryTotalMb,
        memFreeMb: host.memoryAvailableMb,
        loadAvg,
      },
    };
  },
};
