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
  useMockWirex: boolean;
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
          cardIssuanceFee: form.cardIssuanceFee,
          cardTopUpFeePercent: form.cardTopUpFeePercent,
          cardUsageFeePerTransaction: form.cardUsageFeePerTransaction,
          cardMonthlyFee: form.cardMonthlyFee,
          partnerMonthlyFee: form.partnerMonthlyFee,
        },
        useMockWirex: form.useMockWirex,
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
      <div className="app-container">
        <p className="muted-text">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">{t('admin.titleSettings')}</h1>
        <Link to="/admin/dashboard" className="btn-outline">
          {t('admin.backDashboard')}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card-surface admin-settings-form">
        <h3 className="section-title">{t('admin.sectionWirex')}</h3>
        <p className="muted-text admin-settings-desc">{t('admin.settingsDesc')}</p>
        <label className="admin-settings-label">
          {t('admin.environment')}
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

        <label className="admin-settings-label">
          API Base URL
          <input
            type="url"
            className="input"
            value={form.apiBase}
            onChange={(e) => setForm((f) => ({ ...f, apiBase: e.target.value }))}
            placeholder="https://api-baas.wirexapp.tech"
          />
        </label>

        <label className="admin-settings-label">
          Chain ID
          <input
            type="text"
            className="input"
            value={form.chainId}
            onChange={(e) => setForm((f) => ({ ...f, chainId: e.target.value }))}
            placeholder="84532 (Sandbox) / 8453 (Production)"
          />
        </label>

        <label className="admin-settings-label">
          Client ID
          <input
            type="text"
            className="input"
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            placeholder={t('admin.clientIdHint')}
          />
        </label>

        <label className="admin-settings-label">
          Client Secret
          <input
            type="password"
            className="input"
            value={form.clientSecret}
            onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
            placeholder={t('admin.clientSecretHint')}
          />
        </label>

        <h3 className="section-title" style={{ marginTop: '2rem' }}>{t('admin.sectionFees')}</h3>
        <p className="muted-text admin-settings-desc">{t('admin.feesDesc')}</p>
        <label className="admin-settings-label">
          {t('admin.treasuryWallet')}
          <input
            type="text"
            className="input"
            value={form.treasuryWalletAddress}
            onChange={(e) => setForm((f) => ({ ...f, treasuryWalletAddress: e.target.value }))}
            placeholder="0x..."
          />
        </label>
        <label className="admin-settings-label">
          {t('admin.feeIssue')}
          <input
            type="number"
            className="input"
            value={form.cardIssuanceFee}
            onChange={(e) => setForm((f) => ({ ...f, cardIssuanceFee: parseFloat(e.target.value) || 0 }))}
            min={0}
            step={0.1}
          />
        </label>
        <label className="admin-settings-label">
          {t('admin.feeTopup')}
          <input
            type="number"
            className="input"
            value={form.cardTopUpFeePercent}
            onChange={(e) => setForm((f) => ({ ...f, cardTopUpFeePercent: parseFloat(e.target.value) || 0 }))}
            min={0}
            step={0.1}
          />
        </label>
        <label className="admin-settings-label">
          {t('admin.feeUsage')}
          <input
            type="number"
            className="input"
            value={form.cardUsageFeePerTransaction}
            onChange={(e) => setForm((f) => ({ ...f, cardUsageFeePerTransaction: parseFloat(e.target.value) || 0 }))}
            min={0}
            step={0.01}
          />
        </label>
        <label className="admin-settings-label">
          {t('admin.feeMonthly')}
          <input
            type="number"
            className="input"
            value={form.cardMonthlyFee}
            onChange={(e) => setForm((f) => ({ ...f, cardMonthlyFee: parseFloat(e.target.value) || 0 }))}
            min={0}
            step={0.1}
          />
        </label>
        <label className="admin-settings-label">
          {t('admin.feePartner')}
          <input
            type="number"
            className="input"
            value={form.partnerMonthlyFee}
            onChange={(e) => setForm((f) => ({ ...f, partnerMonthlyFee: parseFloat(e.target.value) || 0 }))}
            min={0}
            step={1}
          />
        </label>

        <label className="admin-settings-checkbox">
          <input
            type="checkbox"
            checked={form.useMockWirex}
            onChange={(e) => setForm((f) => ({ ...f, useMockWirex: e.target.checked }))}
          />
          <span>{t('admin.useMock')}</span>
        </label>

        {settings?.updatedAt && (
          <p className="muted-text admin-settings-updated">
            {t('admin.lastSaved')}
            {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}

        {message && (
          <div className={saveOk ? 'admin-settings-success' : 'auth-error'}>{message}</div>
        )}

        <div className="admin-settings-actions">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('admin.saving') : t('admin.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
