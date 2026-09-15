import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type PlatformPayload = {
  config: {
    primaryDomain: string;
    apiPublicUrl: string;
    corsOrigins: string[];
    sslCertPath: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
    otpExpireMinutes: number;
  };
  security: {
    otpRequiredAdmin: boolean;
    otpRequiredMember: boolean;
    otpRequiredOrg: boolean;
  };
  ssl: { status: string; detail: string; daysRemaining: number | null; notAfter: string | null };
  server: {
    hostname: string;
    uptimeSec: number;
    memTotalMb: number;
    memFreeMb: number;
    loadAvg: number[];
  };
  pm2: Array<{ name?: string; pm2_env?: { status?: string }; monit?: { memory?: number; cpu?: number } }>;
};

const LE_GUIDE = `sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d icocard.net -d www.icocard.net
sudo certbot renew --dry-run
# 인증서 경로 예: /etc/letsencrypt/live/icocard.net/fullchain.pem`;

export default function AdminPlatform() {
  const { t } = useTranslation();
  const [data, setData] = useState<PlatformPayload | null>(null);
  const [config, setConfig] = useState<PlatformPayload['config'] | null>(null);
  const [security, setSecurity] = useState<PlatformPayload['security'] | null>(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.admin
      .getPlatform()
      .then((d) => {
        setData(d);
        setConfig(d.config);
        setSecurity(d.security);
      })
      .catch((e) => setMsg((e as Error).message));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!config || !security) return;
    setSaving(true);
    setMsg('');
    try {
      const next = await api.admin.savePlatform({ ...config, security });
      setData(next);
      setConfig(next.config);
      setSecurity(next.security);
      setMsg(t('admin.saved'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!config || !data || !security) {
    return <p className="muted-text">{msg || t('common.loading')}</p>;
  }

  const sslTone = data.ssl.status === 'OK' ? 'ok' : data.ssl.status === 'EXPIRED' ? 'bad' : 'warn';

  return (
    <div>
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
          <label className="span-2">
            {t('admin.platformSslPath')}
            <input className="input" value={config.sslCertPath} onChange={(e) => setConfig({ ...config, sslCertPath: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card-surface">
        <h3 className="section-title">{t('admin.platformEmailOtp')}</h3>
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
            {t('admin.platformSmtpUser')}
            <input className="input" value={config.smtpUser} onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })} />
          </label>
          <label>
            {t('admin.platformSmtpPassword')}
            <input className="input" type="password" value={config.smtpPassword} onChange={(e) => setConfig({ ...config, smtpPassword: e.target.value })} />
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
        </div>
        <div className="hq-toolbar" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>
            {t('admin.save')}
          </button>
        </div>
        {msg ? <p className="muted-text">{msg}</p> : null}
      </div>

      <div className="hq-dash-grid">
        <div className="card-surface">
          <h3 className="section-title">{t('admin.platformSslStatus')}</h3>
          <dl className="hq-dl">
            <dt>{t('admin.colStatus')}</dt>
            <dd><span className={`hq-pill ${sslTone}`}>{data.ssl.status}</span></dd>
            <dt>{t('admin.platformExpiry')}</dt>
            <dd>{data.ssl.detail}</dd>
            <dt>{t('admin.platformDaysLeft')}</dt>
            <dd>{data.ssl.daysRemaining == null ? '-' : data.ssl.daysRemaining}</dd>
          </dl>
        </div>
        <div className="card-surface">
          <h3 className="section-title">{t('admin.platformServer')}</h3>
          <dl className="hq-dl">
            <dt>{t('admin.platformHost')}</dt>
            <dd>{data.server.hostname}</dd>
            <dt>{t('admin.platformMemory')}</dt>
            <dd>{data.server.memFreeMb} / {data.server.memTotalMb} MB</dd>
            <dt>{t('admin.platformLoad')}</dt>
            <dd>{data.server.loadAvg.map((n) => n.toFixed(2)).join(', ')}</dd>
          </dl>
          {data.pm2.length ? (
            <p className="muted-text" style={{ marginTop: 8 }}>
              PM2: {data.pm2.map((p) => `${p.name || '-'} (${p.pm2_env?.status || '-'})`).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="card-surface">
        <h3 className="section-title">{t('admin.platformLeGuide')}</h3>
        <p className="hq-card-hint">{t('admin.platformLeHint')}</p>
        <pre className="hq-pre">{LE_GUIDE}</pre>
      </div>
    </div>
  );
}
