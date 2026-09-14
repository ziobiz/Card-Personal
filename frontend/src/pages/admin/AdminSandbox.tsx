import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Status = Awaited<ReturnType<typeof api.admin.sandboxStatus>>;
type SmokeResult = Awaited<ReturnType<typeof api.admin.sandboxSmoke>>;

export default function AdminSandbox() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SmokeResult | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await api.admin.sandboxStatus());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runSmoke = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await api.admin.sandboxSmoke({
        walletAddress: wallet.trim(),
        email: email.trim() || undefined,
        country: 'GB',
      });
      setResult(r);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      try {
        // surface steps if API returned JSON error body via message only
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <div className="app-container hq-sandbox">
      <div className="page-header">
        <h1 className="page-title">{t('admin.sandboxTitle')}</h1>
        <Link to="/admin/settings" className="btn-outline">
          {t('admin.navSettings')}
        </Link>
      </div>
      <p className="muted-text hq-sandbox-lead">{t('admin.sandboxIntro')}</p>

      <section className="card-surface hq-sandbox-card">
        <div className="hq-sandbox-card-head">
          <h3 className="section-title">{t('admin.sandboxConnection')}</h3>
          <button type="button" className="btn-outline btn-compact" onClick={() => void refresh()} disabled={loading}>
            {t('admin.sandboxRefresh')}
          </button>
        </div>
        {loading && !status ? (
          <p className="muted-text">{t('common.loading')}</p>
        ) : (
          <div className="hq-sandbox-status-grid">
            <div className={`hq-pill ${status?.tokenOk ? 'ok' : status?.mock ? 'warn' : 'bad'}`}>
              {status?.mock ? t('admin.sandboxMockOn') : status?.tokenOk ? t('admin.sandboxTokenOk') : t('admin.sandboxTokenFail')}
            </div>
            <div className="hq-kv">
              <span>{t('admin.environment')}</span>
              <strong>{status?.environment || '—'}</strong>
            </div>
            <div className="hq-kv">
              <span>API</span>
              <strong className="hq-mono">{status?.apiBase || '—'}</strong>
            </div>
            <div className="hq-kv">
              <span>Chain</span>
              <strong>{status?.chainId ?? '—'}</strong>
            </div>
            <div className="hq-kv">
              <span>{t('admin.sandboxWebhook')}</span>
              <strong className="hq-mono">{status?.webhookBaseUrl || '—'}</strong>
            </div>
            <div className="hq-kv">
              <span>{t('admin.brandLocales')}</span>
              <strong>{(status?.enabledLocales || []).join(', ') || '—'}</strong>
            </div>
          </div>
        )}
        {status?.tokenError ? <p className="auth-error">{status.tokenError}</p> : null}
        {status?.note ? <p className="muted-text">{status.note}</p> : null}
      </section>

      <section className="card-surface hq-sandbox-card">
        <h3 className="section-title">{t('admin.sandboxSmokeTitle')}</h3>
        <p className="muted-text">{t('admin.sandboxSmokeHint')}</p>
        <form className="hq-sandbox-form" onSubmit={runSmoke}>
          <label>
            {t('admin.sandboxWallet')}
            <input
              className="input hq-mono"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
              required
            />
          </label>
          <label>
            {t('admin.sandboxEmail')}
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sandbox+test@icocard.net"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy || status?.mock}>
            {busy ? t('common.loading') : t('admin.sandboxRun')}
          </button>
        </form>
        {error ? <p className="auth-error">{error}</p> : null}
        {result ? (
          <ul className="hq-smoke-steps">
            {result.steps?.map((s) => (
              <li key={s.step} className={s.ok ? 'ok' : 'bad'}>
                <strong>{s.step}</strong>
                <span>{s.ok ? 'OK' : 'FAIL'}</span>
                {s.detail != null ? (
                  <code>{typeof s.detail === 'string' ? s.detail : JSON.stringify(s.detail).slice(0, 180)}</code>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card-surface hq-sandbox-card hq-sandbox-asp">
        <h3 className="section-title">{t('admin.sandboxAspTitle')}</h3>
        <ol className="hq-sandbox-asp-list">
          <li>{t('admin.sandboxAsp1')}</li>
          <li>{t('admin.sandboxAsp2')}</li>
          <li>{t('admin.sandboxAsp3')}</li>
          <li>{t('admin.sandboxAsp4')}</li>
        </ol>
      </section>
    </div>
  );
}
