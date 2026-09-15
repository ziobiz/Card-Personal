import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type FeePolicy = {
  treasuryWalletAddress?: string;
  cardIssuanceFee?: number;
  cardTopUpFeePercent?: number;
  cardUsageFeePerTransaction?: number;
  cardMonthlyFee?: number;
  partnerMonthlyFee?: number;
};

type Settings = {
  wirex: { apiBase?: string; chainId?: number; clientId?: string; clientSecret?: string };
  feePolicy?: FeePolicy;
  security?: {
    otpRequiredAdmin?: boolean;
    otpRequiredMember?: boolean;
    otpRequiredOrg?: boolean;
  };
  useMockWirex: boolean;
  walletPolicy?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
  updatedAt?: string;
};

export default function AdminSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [form, setForm] = useState({
    apiBase: '',
    chainId: '',
    clientId: '',
    clientSecret: '',
    useMockWirex: true,
    environment: 'sandbox' as 'sandbox' | 'production',
    treasuryWalletAddress: '',
    cardIssuanceFee: 5,
    cardTopUpFeePercent: 0.5,
    cardUsageFeePerTransaction: 0.1,
    cardMonthlyFee: 2,
    partnerMonthlyFee: 50,
    otpRequiredAdmin: true,
    otpRequiredMember: true,
    otpRequiredOrg: true,
    walletEmbedded: true,
    walletExternal: true,
    walletBridge: true,
  });

  useEffect(() => {
    api.admin
      .getSettings()
      .then((r: Settings & { feePolicy?: FeePolicy }) => {
        setSettings(r);
        const fp = r.feePolicy ?? {};
        setForm({
          apiBase: r.wirex?.apiBase ?? 'https://api-baas.wirexapp.tech',
          chainId: String(r.wirex?.chainId ?? 84532),
          clientId: r.wirex?.clientId ?? '',
          clientSecret: '',
          useMockWirex: r.useMockWirex ?? true,
          environment: (r.wirex as { environment?: 'sandbox' | 'production' })?.environment ?? 'sandbox',
          treasuryWalletAddress: fp.treasuryWalletAddress ?? '',
          cardIssuanceFee: fp.cardIssuanceFee ?? 5,
          cardTopUpFeePercent: fp.cardTopUpFeePercent ?? 0.5,
          cardUsageFeePerTransaction: fp.cardUsageFeePerTransaction ?? 0.1,
          cardMonthlyFee: fp.cardMonthlyFee ?? 2,
          partnerMonthlyFee: fp.partnerMonthlyFee ?? 50,
          otpRequiredAdmin: r.security?.otpRequiredAdmin ?? true,
          otpRequiredMember: r.security?.otpRequiredMember ?? true,
          otpRequiredOrg: r.security?.otpRequiredOrg ?? true,
          walletEmbedded: r.walletPolicy?.embedded !== false,
          walletExternal: r.walletPolicy?.externalEoa !== false,
          walletBridge: r.walletPolicy?.bridge !== false,
        });
      })
      .catch((e) => {
        const msg = (e as Error).message || '';
        if (msg.includes('Admin') || msg.includes('403')) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSaveOk(false);
    setSaving(true);
    try {
      await api.admin.updateSettings({
        wirex: {
          apiBase: form.apiBase || undefined,
          chainId: form.chainId ? parseInt(form.chainId, 10) : undefined,
          clientId: form.clientId || undefined,
          clientSecret: form.clientSecret || undefined,
          environment: form.environment,
        },
        feePolicy: {
          treasuryWalletAddress: form.treasuryWalletAddress || undefined,
        },
        security: {
          otpRequiredAdmin: form.otpRequiredAdmin,
          otpRequiredMember: form.otpRequiredMember,
          otpRequiredOrg: form.otpRequiredOrg,
        },
        useMockWirex: form.useMockWirex,
        walletPolicy: {
          embedded: form.walletEmbedded,
          externalEoa: form.walletExternal,
          bridge: form.walletBridge,
        },
      });
      setMessage(t('admin.saved'));
      setSaveOk(true);
      setForm((f) => ({ ...f, clientSecret: '' }));
    } catch (err) {
      setMessage((err as Error).message);
      setSaveOk(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container hq-sandbox">
        <p className="muted-text">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="app-container hq-sandbox">
      <section className="card-surface hq-sandbox-card">
        <h3 className="section-title">{t('admin.sectionWirex')}</h3>
        <p className="hq-card-hint">{t('admin.settingsDesc')}</p>
        <div className="hq-form-grid">
          <label>
            <span>{t('admin.environment')}</span>
            <select
              className="input"
              value={form.environment}
              onChange={(e) => {
                const environment = e.target.value as 'sandbox' | 'production';
                setForm((f) => ({
                  ...f,
                  environment,
                  apiBase: environment === 'production' ? 'https://api-baas.wirexapp.com' : 'https://api-baas.wirexapp.tech',
                  chainId: environment === 'production' ? '8453' : '84532',
                }));
              }}
            >
              <option value="sandbox">{t('admin.optSandbox')}</option>
              <option value="production">{t('admin.optProduction')}</option>
            </select>
          </label>
          <label>
            <span>API Base URL</span>
            <input type="url" className="input" value={form.apiBase} onChange={(e) => setForm((f) => ({ ...f, apiBase: e.target.value }))} />
          </label>
          <label>
            <span>Chain ID</span>
            <input type="text" className="input" value={form.chainId} onChange={(e) => setForm((f) => ({ ...f, chainId: e.target.value }))} />
          </label>
          <label>
            <span>Client ID</span>
            <input type="text" className="input" value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} placeholder={t('admin.clientIdHint')} />
          </label>
          <label>
            <span>Client Secret</span>
            <input type="password" className="input" value={form.clientSecret} onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} placeholder={t('admin.clientSecretHint')} />
          </label>
        </div>
        <label className="admin-settings-checkbox">
          <input type="checkbox" checked={form.useMockWirex} onChange={(e) => setForm((f) => ({ ...f, useMockWirex: e.target.checked }))} />
          <span>{t('admin.useMock')}</span>
        </label>
      </section>

      <section className="card-surface hq-sandbox-card">
        <h3 className="section-title">{t('admin.walletHqDefault')}</h3>
        <p className="hq-card-hint">{t('admin.walletHqHint')}</p>
        <div className="hq-form-grid">
          <label className="admin-settings-checkbox">
            <input type="checkbox" checked={form.walletEmbedded} onChange={(e) => setForm((f) => ({ ...f, walletEmbedded: e.target.checked }))} />
            {t('walletMode.embedded')}
          </label>
          <label className="admin-settings-checkbox">
            <input type="checkbox" checked={form.walletExternal} onChange={(e) => setForm((f) => ({ ...f, walletExternal: e.target.checked }))} />
            {t('walletMode.external')}
          </label>
          <label className="admin-settings-checkbox">
            <input type="checkbox" checked={form.walletBridge} onChange={(e) => setForm((f) => ({ ...f, walletBridge: e.target.checked }))} />
            {t('walletMode.bridge')}
          </label>
        </div>
      </section>

      <section className="card-surface hq-sandbox-card">
        <h3 className="section-title">{t('admin.sectionOtp')}</h3>
        <p className="hq-card-hint">{t('admin.otpPolicyDesc')}</p>
        <div className="hq-form-grid">
          <label className="admin-settings-checkbox">
            <input type="checkbox" checked={form.otpRequiredAdmin} onChange={(e) => setForm((f) => ({ ...f, otpRequiredAdmin: e.target.checked }))} />
            {t('admin.otpRequiredAdmin')}
          </label>
          <label className="admin-settings-checkbox">
            <input type="checkbox" checked={form.otpRequiredMember} onChange={(e) => setForm((f) => ({ ...f, otpRequiredMember: e.target.checked }))} />
            {t('admin.otpRequiredMember')}
          </label>
          <label className="admin-settings-checkbox">
            <input type="checkbox" checked={form.otpRequiredOrg} onChange={(e) => setForm((f) => ({ ...f, otpRequiredOrg: e.target.checked }))} />
            {t('admin.otpRequiredOrg')}
          </label>
        </div>
      </section>

      <section className="card-surface hq-sandbox-card">
        <h3 className="section-title">{t('admin.sectionFees')}</h3>
        <p className="hq-card-hint">{t('admin.settingsFeeHint')}</p>
        <div className="hq-form-grid">
          <label>
            <span>{t('admin.treasuryWallet')}</span>
            <input type="text" className="input" value={form.treasuryWalletAddress} onChange={(e) => setForm((f) => ({ ...f, treasuryWalletAddress: e.target.value }))} placeholder="0x..." />
          </label>
        </div>
        <div className="hq-toolbar" style={{ justifyContent: 'flex-start' }}>
          <Link to="/admin/fee-policy" className="btn-secondary">{t('admin.navFeePolicy')}</Link>
        </div>
      </section>

      {settings?.updatedAt ? (
        <p className="muted-text">
          {t('admin.lastSaved')}
          {new Date(settings.updatedAt).toLocaleString()}
        </p>
      ) : null}
      {message ? <div className={saveOk ? 'admin-settings-success' : 'auth-error'}>{message}</div> : null}
      <div className="reg-actions">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('admin.saving') : t('admin.save')}
        </button>
      </div>
    </form>
  );
}
