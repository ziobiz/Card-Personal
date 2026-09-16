import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type HealthLevel, type PlatformPayload } from '../../api';
import type { AdminOutletContext } from '../../components/AdminLayout';
import { useHqConfirm } from '../../components/ConfirmActionContext';

type Cfg = PlatformPayload['config'];
type Sec = PlatformPayload['security'];

function gbInput(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

function parseGb(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(2)} TB`;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

function fmtUptime(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function leGuide(domain: string, live: string): string {
  const d = domain || 'icocard.net';
  const liveName = live || d;
  return `sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ${d} -d www.${d}
sudo certbot renew --dry-run
sudo systemctl status certbot.timer

# fullchain: /etc/letsencrypt/live/${liveName}/fullchain.pem
# SAN 추가: sudo certbot --nginx -d ${d} -d www.${d} -d api.${d}
# Cloudflare 주황구름이면 DNS-01:
#   sudo certbot certonly --dns-cloudflare -d ${d} -d '*.${d}'`;
}

function MiniBars({
  data,
  color,
}: {
  data: Array<{ date: string; value: number }>;
  color: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hq-bars hq-srv-bars">
      {data.map((d) => (
        <div key={d.date} className="hq-bar-col" title={`${d.date}: ${d.value}`}>
          <div className="hq-bar" style={{ height: `${(d.value / max) * 100}px`, background: color }} />
          <span className="hq-bar-label">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPlatform() {
  const { t } = useTranslation();
  const { setPageActions } = useOutletContext<AdminOutletContext>();
  const { confirmSave } = useHqConfirm();
  const [data, setData] = useState<PlatformPayload | null>(null);
  const [config, setConfig] = useState<Cfg | null>(null);
  const [security, setSecurity] = useState<Sec | null>(null);
  const [refreshMin, setRefreshMin] = useState('2');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [countdown, setCountdown] = useState(0);

  const applyPayload = (d: PlatformPayload) => {
    setData(d);
    setConfig(d.config);
    setSecurity(d.security);
    const sec = d.config.uiRefreshSec || d.uiAutoRefreshSeconds || 120;
    setRefreshMin(String(Math.max(1, Math.round(sec / 60))));
    setCountdown(d.uiAutoRefreshSeconds || sec);
  };

  const load = useCallback((silent = false) => {
    api.admin
      .getPlatform()
      .then(applyPayload)
      .catch((e) => {
        if (!silent) setMsg((e as Error).message);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const interval = Math.max(15, data.uiAutoRefreshSeconds || 120);
    const tick = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          load(true);
          return interval;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [data?.uiAutoRefreshSeconds, load]);

  const save = useCallback(async () => {
    if (!config || !security) return;
    if (!(await confirmSave())) return;
    setSaving(true);
    setMsg('');
    try {
      const min = Number(refreshMin);
      const uiRefreshSec = Number.isFinite(min) && min > 0 ? Math.round(min * 60) : 120;
      const next = await api.admin.savePlatform({
        ...config,
        uiRefreshSec,
        security,
      });
      applyPayload(next);
      setMsg(t('admin.saved'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [config, security, refreshMin, t, confirmSave]);

  useEffect(() => {
    setPageActions(
      <>
        <button type="button" className="hq-btn-sky" onClick={() => load()}>
          {t('admin.srv.refresh')}
        </button>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {t('admin.save')}
        </button>
      </>
    );
    return () => setPageActions(null);
  }, [setPageActions, t, saving, save, load]);

  const sendTest = async () => {
    setMsg('');
    try {
      await api.admin.testPlatformMail(mailTo);
      setMsg(t('admin.srv.mailSent'));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const alertText = (key: string, args: unknown[]) => {
    const vars: Record<string, unknown> = {
      date: args[0],
      days: args[0],
      n: args[1] ?? args[0],
      quota: args[0],
    };
    return t(`admin.srv.alert.${key}`, vars);
  };

  const worst = data?.health.worstStatus || 'ok';

  const memSeries = useMemo(
    () => (data?.metrics || []).map((m) => ({ date: m.date, value: m.memUsedPct })),
    [data]
  );
  const diskSeries = useMemo(
    () => (data?.metrics || []).map((m) => ({ date: m.date, value: m.diskUsedPct })),
    [data]
  );

  if (!config || !data || !security) {
    return <p className="muted-text">{msg || t('common.loading')}</p>;
  }

  const sslTone: HealthLevel =
    data.ssl.status === 'OK'
      ? (data.ssl.daysRemaining != null && data.ssl.daysRemaining < 30 ? 'warn' : 'ok')
      : data.ssl.status === 'EXPIRED'
        ? 'danger'
        : 'warn';

  return (
    <div className="hq-srv">
      <div className="hq-srv-toolbar card-surface">
        <div className="hq-srv-toolbar-main">
          <span className={`hq-pill ${worst === 'danger' ? 'bad' : worst === 'warn' ? 'warn' : 'ok'}`}>
            {t(`admin.srv.level.${worst}`)}
          </span>
          <span className="muted-text">
            {t('admin.srv.generatedAt')}: {new Date(data.generatedAt).toLocaleString()}
          </span>
          <span className="muted-text">
            {t('admin.srv.nextRefresh')}: {countdown}s
          </span>
        </div>
        {msg ? <p className="muted-text hq-srv-msg">{msg}</p> : null}
      </div>

      {data.health.alerts.length ? (
        <div className="hq-srv-alerts">
          {data.health.alerts.map((a, i) => (
            <div key={`${a.key}-${i}`} className={`hq-srv-alert is-${a.level}`}>
              {alertText(a.key, a.args)}
            </div>
          ))}
        </div>
      ) : null}

      <div className="hq-srv-health">
        {data.health.rows.map((row) => (
          <div key={row.id} className={`card-surface hq-srv-health-card is-${row.status}`}>
            <div className="hq-srv-health-top">
              <strong>{t(`admin.srv.row.${row.labelKey}`)}</strong>
              <span className={`hq-pill ${row.status === 'danger' ? 'bad' : row.status === 'warn' ? 'warn' : 'ok'}`}>
                {t(`admin.srv.level.${row.status}`)}
              </span>
            </div>
            <div className="hq-srv-health-val">{row.value}</div>
            <div className="hq-srv-health-crit">{row.criteria}</div>
            {row.pct != null ? (
              <div className="hq-srv-meter">
                <div
                  className={`hq-srv-meter-bar is-${row.status}`}
                  style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="card-surface">
        <h3 className="section-title">{t('admin.platformDomain')}</h3>
        <p className="hq-card-hint">{t('admin.platformDesc')}</p>
        <div className="hq-platform-grid">
          <label>
            {t('admin.platformMainDomain')}
            <input className="input" value={config.primaryDomain} onChange={(e) => setConfig({ ...config, primaryDomain: e.target.value })} />
          </label>
          <label>
            {t('admin.platformApiUrl')}
            <input className="input" value={config.apiPublicUrl} onChange={(e) => setConfig({ ...config, apiPublicUrl: e.target.value })} />
          </label>
          <label className="span-2">
            {t('admin.platformCors')}
            <input
              className="input"
              value={config.corsOrigins.join(', ')}
              onChange={(e) =>
                setConfig({
                  ...config,
                  corsOrigins: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </label>
          <label>
            {t('admin.platformSslPath')}
            <input className="input" value={config.sslCertPath} onChange={(e) => setConfig({ ...config, sslCertPath: e.target.value })} />
          </label>
          <label>
            {t('admin.srv.leDomain')}
            <input className="input" value={config.sslLeDomain} onChange={(e) => setConfig({ ...config, sslLeDomain: e.target.value })} />
          </label>
          <label>
            {t('admin.srv.refreshMin')}
            <input className="input" type="number" min={1} max={60} value={refreshMin} onChange={(e) => setRefreshMin(e.target.value)} />
          </label>
          <label>
            {t('admin.srv.nginxStub')}
            <input
              className="input"
              value={config.nginxStubStatusUrl}
              onChange={(e) => setConfig({ ...config, nginxStubStatusUrl: e.target.value })}
              placeholder="http://127.0.0.1/nginx_status"
            />
          </label>
        </div>
      </div>

      <div className="card-surface">
        <h3 className="section-title">{t('admin.srv.contractTitle')}</h3>
        <p className="hq-card-hint">{t('admin.srv.contractHint')}</p>
        <div className="hq-platform-grid">
          <label>
            {t('admin.srv.contractDisk')}
            <input
              className="input"
              value={gbInput(config.contractDiskGb)}
              onChange={(e) => setConfig({ ...config, contractDiskGb: parseGb(e.target.value) })}
              placeholder="예: 40"
            />
          </label>
          <label>
            {t('admin.srv.contractTraffic')}
            <input
              className="input"
              value={gbInput(config.contractTrafficGb)}
              onChange={(e) => setConfig({ ...config, contractTrafficGb: parseGb(e.target.value) })}
              placeholder="예: 1000"
            />
          </label>
          <label>
            {t('admin.srv.trafficUsed')}
            <input
              className="input"
              value={gbInput(config.trafficUsedGb)}
              onChange={(e) => setConfig({ ...config, trafficUsedGb: parseGb(e.target.value) })}
              placeholder={t('admin.srv.trafficUsedPh')}
            />
          </label>
          <label>
            {t('admin.srv.contractStart')}
            <input className="input" type="date" value={config.contractStart || ''} onChange={(e) => setConfig({ ...config, contractStart: e.target.value })} />
          </label>
          <label>
            {t('admin.srv.contractEnd')}
            <input className="input" type="date" value={config.contractEnd || ''} onChange={(e) => setConfig({ ...config, contractEnd: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card-surface">
        <h3 className="section-title">{t('admin.platformEmailOtp')}</h3>
        <p className="hq-card-hint">{t('admin.srv.emailHint')}</p>
        <div className="hq-platform-grid">
          <label>
            {t('admin.platformSmtpHost')}
            <input className="input" value={config.smtpHost} onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })} />
          </label>
          <label>
            {t('admin.platformSmtpPort')}
            <input className="input" type="number" value={config.smtpPort} onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) || 0 })} />
          </label>
          <label>
            {t('admin.srv.smtpSecure')}
            <select
              className="input"
              value={config.smtpSecure ? '1' : '0'}
              onChange={(e) => setConfig({ ...config, smtpSecure: e.target.value === '1' })}
            >
              <option value="0">{t('admin.otpOff')} (STARTTLS 587)</option>
              <option value="1">{t('admin.otpOn')} (SSL 465)</option>
            </select>
          </label>
          <label>
            {t('admin.platformSmtpUser')}
            <input className="input" value={config.smtpUser} onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })} />
          </label>
          <label>
            {t('admin.platformSmtpPassword')}
            <input className="input" type="password" value={config.smtpPassword} onChange={(e) => setConfig({ ...config, smtpPassword: e.target.value })} />
          </label>
          <label>
            {t('admin.srv.smtpFromName')}
            <input className="input" value={config.smtpFromName} onChange={(e) => setConfig({ ...config, smtpFromName: e.target.value })} />
          </label>
          <label>
            {t('admin.platformSmtpFrom')}
            <input className="input" value={config.smtpFrom} onChange={(e) => setConfig({ ...config, smtpFrom: e.target.value })} />
          </label>
          <label>
            {t('admin.platformOtpExpire')}
            <input className="input" type="number" value={config.otpExpireMinutes} onChange={(e) => setConfig({ ...config, otpExpireMinutes: Number(e.target.value) || 5 })} />
          </label>
          <label>
            <span>{t('admin.otpAdmin')}</span>
            <select
              className="input"
              value={security.otpRequiredAdmin ? '1' : '0'}
              onChange={(e) => setSecurity({ ...security, otpRequiredAdmin: e.target.value === '1' })}
            >
              <option value="1">{t('admin.otpOn')}</option>
              <option value="0">{t('admin.otpOff')}</option>
            </select>
          </label>
          <label>
            <span>{t('admin.otpMember')}</span>
            <select
              className="input"
              value={security.otpRequiredMember ? '1' : '0'}
              onChange={(e) => setSecurity({ ...security, otpRequiredMember: e.target.value === '1' })}
            >
              <option value="1">{t('admin.otpOn')}</option>
              <option value="0">{t('admin.otpOff')}</option>
            </select>
          </label>
          <label>
            <span>{t('admin.otpRequiredOrg')}</span>
            <select
              className="input"
              value={security.otpRequiredOrg ? '1' : '0'}
              onChange={(e) => setSecurity({ ...security, otpRequiredOrg: e.target.value === '1' })}
            >
              <option value="1">{t('admin.otpOn')}</option>
              <option value="0">{t('admin.otpOff')}</option>
            </select>
          </label>
          <label>
            {t('admin.srv.mailTestTo')}
            <input className="input" value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="ops@icocard.net" />
          </label>
        </div>
        <div className="hq-toolbar" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn-outline" onClick={sendTest} disabled={!mailTo.trim()}>
            {t('admin.srv.mailTest')}
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>
            {t('admin.save')}
          </button>
        </div>
      </div>

      <div className="hq-dash-grid">
        <div className="card-surface">
          <h3 className="section-title">{t('admin.platformSslStatus')}</h3>
          <dl className="hq-dl">
            <dt>{t('admin.colStatus')}</dt>
            <dd><span className={`hq-pill ${sslTone === 'danger' ? 'bad' : sslTone}`}>{data.ssl.status}</span></dd>
            <dt>{t('admin.platformExpiry')}</dt>
            <dd>{data.ssl.notAfter ? new Date(data.ssl.notAfter).toLocaleString() : data.ssl.detail || '—'}</dd>
            <dt>{t('admin.platformDaysLeft')}</dt>
            <dd>{data.ssl.daysRemaining == null ? '—' : data.ssl.daysRemaining}</dd>
            <dt>{t('admin.srv.sslIssuer')}</dt>
            <dd>{data.ssl.issuerDn || '—'}</dd>
            <dt>{t('admin.srv.sslSubject')}</dt>
            <dd>{data.ssl.subjectDn || '—'}</dd>
            <dt>{t('admin.srv.sslFp')}</dt>
            <dd className="hq-srv-mono">{data.ssl.fingerprintSha256 || '—'}</dd>
            <dt>{t('admin.srv.sslPath')}</dt>
            <dd className="hq-srv-mono">{data.ssl.resolvedPath || '—'}</dd>
            <dt>SAN</dt>
            <dd>{data.ssl.sanDnsNames.length ? data.ssl.sanDnsNames.join(', ') : '—'}</dd>
          </dl>
          {data.linkage.missing.length ? (
            <p className="hq-srv-alert is-warn">{t('admin.srv.sanMissing', { hosts: data.linkage.missing.join(', ') })}</p>
          ) : null}
          {data.linkage.rows.length ? (
            <table className="admin-table hq-srv-table">
              <thead>
                <tr>
                  <th>{t('admin.srv.host')}</th>
                  <th>{t('admin.srv.source')}</th>
                  <th>SAN</th>
                </tr>
              </thead>
              <tbody>
                {data.linkage.rows.map((r, i) => (
                  <tr key={`${r.source}-${r.hostname}-${i}`}>
                    <td>{r.hostname}</td>
                    <td>{r.source}</td>
                    <td>
                      <span className={`hq-pill ${r.inCertificate ? 'ok' : 'bad'}`}>
                        {r.inCertificate ? t('admin.srv.inCert') : t('admin.srv.notInCert')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <div className="card-surface">
          <h3 className="section-title">{t('admin.platformServer')}</h3>
          <dl className="hq-dl">
            <dt>{t('admin.platformHost')}</dt>
            <dd>{data.host.hostname}</dd>
            <dt>OS</dt>
            <dd>{data.host.osFamily} {data.host.osVersion} ({data.host.arch})</dd>
            <dt>CPU</dt>
            <dd>{data.host.cpuCount}</dd>
            <dt>{t('admin.srv.uptime')}</dt>
            <dd>{fmtUptime(data.host.uptimeSec)}</dd>
            <dt>{t('admin.platformMemory')}</dt>
            <dd>{data.host.memoryAvailableMb} / {data.host.memoryTotalMb} MB</dd>
            <dt>{t('admin.platformLoad')}</dt>
            <dd>{data.host.loadAvg.map((n) => n.toFixed(2)).join(', ')}</dd>
            <dt>Node</dt>
            <dd>{data.process.nodeVersion} · heap {data.process.heapUsedMb}/{data.process.heapMaxMb} MB · RSS {data.process.rssMb} MB</dd>
            <dt>{t('admin.srv.disk')}</dt>
            <dd>
              {data.disk.ok
                ? `${fmtBytes(data.disk.usedBytes)} / ${fmtBytes(data.disk.totalBytes)} (${data.disk.usedPct}%)`
                : data.disk.error || '—'}
            </dd>
            <dt>Nginx stub</dt>
            <dd>
              {!data.nginxStub.configured
                ? t('admin.srv.nginxOff')
                : data.nginxStub.ok
                  ? `active ${data.nginxStub.active ?? '—'} · R/W/W ${data.nginxStub.reading ?? 0}/${data.nginxStub.writing ?? 0}/${data.nginxStub.waiting ?? 0}`
                  : data.nginxStub.error || 'error'}
            </dd>
          </dl>
        </div>
      </div>

      <div className="card-surface">
        <h3 className="section-title">PM2</h3>
        {data.pm2.length ? (
          <table className="admin-table hq-srv-table">
            <thead>
              <tr>
                <th>{t('admin.srv.procName')}</th>
                <th>{t('admin.colStatus')}</th>
                <th>CPU</th>
                <th>Mem</th>
                <th>{t('admin.srv.uptime')}</th>
                <th>{t('admin.srv.restarts')}</th>
              </tr>
            </thead>
            <tbody>
              {data.pm2.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>
                    <span className={`hq-pill ${p.status === 'online' ? 'ok' : 'warn'}`}>{p.status}</span>
                  </td>
                  <td>{p.cpu}%</td>
                  <td>{p.memoryMb} MB</td>
                  <td>{fmtUptime(p.uptimeMs / 1000)}</td>
                  <td>{p.restarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted-text">{t('admin.srv.pm2Empty')}</p>
        )}
      </div>

      <div className="hq-dash-grid">
        <div className="card-surface">
          <h3 className="section-title">{t('admin.srv.chartMem')}</h3>
          {memSeries.length ? <MiniBars data={memSeries} color="#5b8def" /> : <p className="muted-text">{t('admin.srv.chartEmpty')}</p>}
        </div>
        <div className="card-surface">
          <h3 className="section-title">{t('admin.srv.chartDisk')}</h3>
          {diskSeries.length ? <MiniBars data={diskSeries} color="#2f9e5f" /> : <p className="muted-text">{t('admin.srv.chartEmpty')}</p>}
        </div>
      </div>

      <div className="card-surface">
        <h3 className="section-title">{t('admin.platformLeGuide')}</h3>
        <p className="hq-card-hint">{t('admin.platformLeHint')}</p>
        <ul className="hq-srv-ops">
          <li>{t('admin.srv.ops.dns')}</li>
          <li>{t('admin.srv.ops.leSan')}</li>
          <li>{t('admin.srv.ops.cloudflare')}</li>
        </ul>
        <dl className="hq-dl">
          <dt>certbot.timer</dt>
          <dd>
            {data.certbot.timerActive || '—'}
            {data.certbot.timerNext ? ` · next ${data.certbot.timerNext}` : ''}
          </dd>
          <dt>renewal</dt>
          <dd>{data.certbot.renewalConfFiles.length ? data.certbot.renewalConfFiles.join(', ') : '—'}</dd>
        </dl>
        <pre className="hq-pre">{leGuide(config.primaryDomain, config.sslLeDomain || data.ssl.leLiveCertName)}</pre>
      </div>
    </div>
  );
}
