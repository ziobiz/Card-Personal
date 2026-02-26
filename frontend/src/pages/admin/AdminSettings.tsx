import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    apiBase: '',
    chainId: '',
    clientId: '',
    clientSecret: '',
    useMockWirex: true,
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
    setSaving(true);
    try {
      await api.admin.updateSettings({
        wirex: {
          apiBase: form.apiBase || undefined,
          chainId: form.chainId ? parseInt(form.chainId, 10) : undefined,
          clientId: form.clientId || undefined,
          clientSecret: form.clientSecret || undefined,
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
      setMessage('저장되었습니다.');
      setForm((f) => ({ ...f, clientSecret: '' }));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <p className="muted-text">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">환경설정</h1>
        <Link to="/admin/dashboard" className="btn-outline">
          ← 대시보드
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card-surface admin-settings-form">
        <h3 className="section-title">Wirex BaaS API</h3>
        <p className="muted-text admin-settings-desc">
          Wirex API 연동 정보를 입력하세요. 빈 값은 환경변수 또는 Sandbox 기본값을 사용합니다.
        </p>

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
            placeholder="Wirex 파트너 승인 후 발급"
          />
        </label>

        <label className="admin-settings-label">
          Client Secret
          <input
            type="password"
            className="input"
            value={form.clientSecret}
            onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
            placeholder="변경 시에만 입력 (기존 유지: 공란)"
          />
        </label>

        <h3 className="section-title" style={{ marginTop: '2rem' }}>수수료 정책</h3>
        <p className="muted-text admin-settings-desc">
          수수료는 월렛에서 자동으로 재무 월렛 주소로 이체됩니다. 재무 월렛을 설정해야 수수료가 부과됩니다.
        </p>
        <label className="admin-settings-label">
          재무 월렛 주소 (수수료 수령)
          <input
            type="text"
            className="input"
            value={form.treasuryWalletAddress}
            onChange={(e) => setForm((f) => ({ ...f, treasuryWalletAddress: e.target.value }))}
            placeholder="0x..."
          />
        </label>
        <label className="admin-settings-label">
          카드 발급 비용 (USD)
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
          카드 충전 수수료 (%)
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
          카드 사용 건당 수수료 (USD)
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
          카드 월간 이용료 (USD)
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
          파트너 월간 API 이용료 (USD)
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
          <span>Mock 모드 사용 (실제 API 대신 시뮬레이션)</span>
        </label>

        {settings?.updatedAt && (
          <p className="muted-text admin-settings-updated">
            마지막 저장: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}

        {message && (
          <div className={message.includes('저장') ? 'admin-settings-success' : 'auth-error'}>
            {message}
          </div>
        )}

        <div className="admin-settings-actions">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
