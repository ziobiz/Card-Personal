import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type PartnerFees = {
  cardIssuanceFee?: number;
  cardTopUpFeePercent?: number;
  cardUsageFeePerTransaction?: number;
  cardMonthlyFee?: number;
  partnerMonthlyFee?: number;
};

type Partner = {
  id: string;
  name: string;
  companyName?: string;
  apiKeyPrefix: string;
  status: string;
  billingWalletAddress?: string;
  billingWarnings?: number;
  lastBillingMonth?: string;
  fees?: PartnerFees;
  customFees?: boolean;
  feePolicyId?: string;
  feeSource?: string;
  feeTemplateName?: string;
  effectiveFees?: PartnerFees;
  createdAt: string;
};

export default function AdminPartners() {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; isHqDefault: boolean }>>([]);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const [feePartner, setFeePartner] = useState<Partner | null>(null);
  const [feeForm, setFeeForm] = useState({
    cardIssuanceFee: 5,
    cardTopUpFeePercent: 0.5,
    cardUsageFeePerTransaction: 0.1,
    cardMonthlyFee: 2,
    partnerMonthlyFee: 50,
  });

  const fetchPartners = () => {
    api.admin
      .getPartners()
      .then((r) => setPartners(r.items))
      .catch((e) => {
        const msg = (e as Error).message || '';
        if (msg.includes('Admin') || msg.includes('403')) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPartners();
    api.admin.getFeeTemplates().then((r) => setTemplates(r.items)).catch(() => setTemplates([]));
  }, []);

  const handleRegenerate = async (id: string) => {
    if (!confirm(t('admin.confirmRegen'))) return;
    setMessage('');
    setMessageOk(false);
    try {
      const r = await api.admin.regeneratePartnerKey(id);
      setNewApiKey(r.apiKey);
      setMessage(t('admin.newApiKey') + r.apiKey);
      setMessageOk(true);
      fetchPartners();
    } catch (err) {
      setMessage((err as Error).message);
      setMessageOk(false);
    }
  };

  const openFees = (p: Partner) => {
    const e = p.effectiveFees ?? p.fees ?? {};
    setFeeForm({
      cardIssuanceFee: e.cardIssuanceFee ?? 5,
      cardTopUpFeePercent: e.cardTopUpFeePercent ?? 0.5,
      cardUsageFeePerTransaction: e.cardUsageFeePerTransaction ?? 0.1,
      cardMonthlyFee: e.cardMonthlyFee ?? 2,
      partnerMonthlyFee: e.partnerMonthlyFee ?? 50,
    });
    setFeePartner(p);
  };

  const handleSaveFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feePartner) return;
    setMessage('');
    setMessageOk(false);
    try {
      await api.admin.updatePartner(feePartner.id, { fees: feeForm });
      setMessage(t('admin.feesSaved'));
      setMessageOk(true);
      setFeePartner(null);
      fetchPartners();
    } catch (err) {
      setMessage((err as Error).message);
      setMessageOk(false);
    }
  };

  const handleResetFees = async () => {
    if (!feePartner) return;
    try {
      await api.admin.updatePartner(feePartner.id, { resetFees: true });
      setMessage(t('admin.feesReset'));
      setMessageOk(true);
      setFeePartner(null);
      fetchPartners();
    } catch (err) {
      setMessage((err as Error).message);
      setMessageOk(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.admin.updatePartner(id, { status: status as 'active' | 'suspended' });
      fetchPartners();
    } catch (err) {
      setMessage((err as Error).message);
      setMessageOk(false);
    }
  };

  const apiBase =
    import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');

  return (
    <div className="app-container">
      <div className="hq-toolbar">
        <Link to="/admin/partners/new" className="btn-primary">
          {t('admin.navPartnerReg')}
        </Link>
        <button
          onClick={async () => {
            try {
              const r = await api.admin.runPartnerBilling();
              alert(
                `${t('admin.billingDone')}: ${r.month}\n${r.results.map((x) => `${x.name}: ${x.status}`).join('\n')}`
              );
              fetchPartners();
            } catch (e) {
              alert((e as Error).message);
            }
          }}
          className="btn-secondary"
        >
          {t('admin.runBilling')}
        </button>
      </div>

      <p className="muted-text admin-partners-desc">{t('admin.partnersDesc')}</p>

      {feePartner && (
        <form onSubmit={handleSaveFees} className="card-surface admin-partners-create">
          <h3>{t('admin.editFees')} — {feePartner.name}</h3>
          <p className="muted-text">{t('admin.feePerPartner')}</p>
          <label className="admin-settings-label">
            {t('admin.feeIssue')}
            <input type="number" className="input" min={0} step={0.1} value={feeForm.cardIssuanceFee} onChange={(e) => setFeeForm((f) => ({ ...f, cardIssuanceFee: parseFloat(e.target.value) || 0 }))} />
          </label>
          <label className="admin-settings-label">
            {t('admin.feeTopup')}
            <input type="number" className="input" min={0} step={0.1} value={feeForm.cardTopUpFeePercent} onChange={(e) => setFeeForm((f) => ({ ...f, cardTopUpFeePercent: parseFloat(e.target.value) || 0 }))} />
          </label>
          <label className="admin-settings-label">
            {t('admin.feeUsage')}
            <input type="number" className="input" min={0} step={0.01} value={feeForm.cardUsageFeePerTransaction} onChange={(e) => setFeeForm((f) => ({ ...f, cardUsageFeePerTransaction: parseFloat(e.target.value) || 0 }))} />
          </label>
          <label className="admin-settings-label">
            {t('admin.feeMonthly')}
            <input type="number" className="input" min={0} step={0.1} value={feeForm.cardMonthlyFee} onChange={(e) => setFeeForm((f) => ({ ...f, cardMonthlyFee: parseFloat(e.target.value) || 0 }))} />
          </label>
          <label className="admin-settings-label">
            {t('admin.feePartner')}
            <input type="number" className="input" min={0} step={1} value={feeForm.partnerMonthlyFee} onChange={(e) => setFeeForm((f) => ({ ...f, partnerMonthlyFee: parseFloat(e.target.value) || 0 }))} />
          </label>
          <div className="admin-settings-actions">
            <button type="button" onClick={() => setFeePartner(null)} className="btn-secondary">{t('common.cancel')}</button>
            <button type="button" onClick={handleResetFees} className="btn-outline">{t('admin.useDefaultFees')}</button>
            <button type="submit" className="btn-primary">{t('admin.save')}</button>
          </div>
        </form>
      )}

      {newApiKey && (
        <div className="card-surface admin-api-key-modal">
          <h3>{t('admin.apiKeyOnce')}</h3>
          <code className="admin-api-key-value">{newApiKey}</code>
          <p className="muted-text">{t('admin.apiKeySave')}</p>
          <button onClick={() => setNewApiKey(null)} className="btn-primary">
            {t('common.confirm')}
          </button>
        </div>
      )}

      {message && (
        <div className={messageOk ? 'admin-settings-success' : 'auth-error'}>{message}</div>
      )}

      <div className="card-surface admin-api-docs">
        <h3>{t('admin.endpoints')}</h3>
        <p className="muted-text">Base URL: {apiBase || window.location.origin}/api/partner/v1</p>
        <div className="admin-api-sections">
          <div>
            <h4>{t('admin.sectionCards')}</h4>
            <ul className="admin-api-list">
              <li>
                <code>GET /cards</code>
                <span className="admin-api-ep-desc"> - {t('admin.epCardsList', { defaultValue: '카드 목록' })}</span>
              </li>
              <li>
                <code>POST /cards/virtual</code>
                <span className="admin-api-ep-desc"> - {t('admin.epCardsVirtual', { defaultValue: '가상 카드 발급' })}</span>
              </li>
              <li>
                <code>POST /cards/plastic</code>
                <span className="admin-api-ep-desc"> - {t('admin.epCardsPlastic', { defaultValue: '실물 카드 발급' })}</span>
              </li>
              <li>
                <code>PUT /cards/:cardId/block</code>
                <span className="admin-api-ep-desc"> - {t('admin.epCardsBlock', { defaultValue: '카드 차단' })}</span>
              </li>
              <li>
                <code>PUT /cards/:cardId/unblock</code>
                <span className="admin-api-ep-desc"> - {t('admin.epCardsUnblock', { defaultValue: '차단 해제' })}</span>
              </li>
              <li>
                <code>PUT /cards/:cardId/limit</code>
                <span className="admin-api-ep-desc"> - {t('admin.epCardsLimit', { defaultValue: '한도 설정' })}</span>
              </li>
            </ul>
          </div>
          <div>
            <h4>{t('admin.sectionWallet')}</h4>
            <ul className="admin-api-list">
              <li>
                <code>GET /wallet/balance</code>
                <span className="admin-api-ep-desc"> - {t('admin.epWalletBalance', { defaultValue: '잔액 조회' })}</span>
              </li>
              <li>
                <code>GET /wallet/tokens</code>
                <span className="admin-api-ep-desc"> - {t('admin.epWalletTokens', { defaultValue: '지원 토큰 목록' })}</span>
              </li>
              <li>
                <code>GET /wallet/card/:cardId/deposit-info</code>
                <span className="admin-api-ep-desc"> - {t('admin.epWalletDepositInfo', { defaultValue: '충전 정보' })}</span>
              </li>
              <li>
                <code>POST /wallet/card/:cardId/deposit</code>
                <span className="admin-api-ep-desc"> - {t('admin.epWalletDeposit', { defaultValue: '카드 충전' })}</span>
              </li>
            </ul>
          </div>
        </div>
        <p className="admin-api-auth">
          <strong>{t('admin.authLabel')}</strong> <code>X-API-Key: &lt;api_key&gt;</code> or <code>Authorization: Bearer &lt;api_key&gt;</code>
          <br />
          <strong>{t('admin.userIdLabel')}</strong> <code>X-Partner-User-Id</code>
        </p>
      </div>

      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colPartner')}</th>
                <th>{t('admin.colCompany')}</th>
                <th>{t('admin.orgParent')}</th>
                <th>{t('admin.colCards')}</th>
                <th>{t('admin.colBillingWallet')}</th>
                <th>{t('admin.colWarnings')}</th>
                <th>{t('admin.colApiKey')}</th>
                <th>{t('admin.colFees')}</th>
                <th>{t('admin.colStatus')}</th>
                <th>{t('admin.colJoined')}</th>
                <th>{t('admin.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.companyName || '-'}</td>
                  <td>{(p as { orgParentName?: string }).orgParentName || '-'}</td>
                  <td>
                    <select
                      className="input"
                      value={(p as { cardIssuePolicy?: string }).cardIssuePolicy || 'VIRTUAL'}
                      onChange={async (e) => {
                        await api.admin.updatePartner(p.id, { cardIssuePolicy: e.target.value });
                        fetchPartners();
                      }}
                    >
                      <option value="ALL">{t('admin.issuePolicy.ALL')}</option>
                      <option value="VIRTUAL">{t('admin.issuePolicy.VIRTUAL')}</option>
                      <option value="PLASTIC">{t('admin.issuePolicy.PLASTIC')}</option>
                      <option value="STOPPED">{t('admin.issuePolicy.STOPPED')}</option>
                    </select>
                  </td>
                  <td className="mono">{p.billingWalletAddress ? p.billingWalletAddress.slice(0, 10) + '...' : '-'}</td>
                  <td>{p.billingWarnings ?? 0}</td>
                  <td className="mono">{p.apiKeyPrefix}</td>
                  <td>
                    {p.customFees ? t('admin.feesCustom') : p.feeSource === 'template' ? p.feeTemplateName : t('admin.feeFollowHq')}
                    <div className="muted-text">
                      {t('admin.feePartner')}: {p.effectiveFees?.partnerMonthlyFee ?? '-'}
                    </div>
                    <select
                      className="input"
                      value={p.customFees ? '__custom' : (p.feePolicyId || '')}
                      onChange={async (e) => {
                        const v = e.target.value;
                        if (v === '__custom') return;
                        await api.admin.updatePartner(p.id, { feePolicyId: v, resetFees: true });
                        fetchPartners();
                      }}
                    >
                      <option value="">{t('admin.feeFollowHq')}</option>
                      {templates.filter((x) => !x.isHqDefault).map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                      ))}
                      {p.customFees && <option value="__custom">{t('admin.feesCustom')}</option>}
                    </select>
                  </td>
                  <td>
                    <select
                      value={p.status}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      className="admin-status-select"
                    >
                      <option value="active">{t('admin.statusActive')}</option>
                      <option value="suspended">{t('admin.statusSuspended')}</option>
                    </select>
                  </td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => {
                        const addr = prompt(t('admin.promptWallet'));
                        if (addr) {
                          api.admin.updatePartner(p.id, { billingWalletAddress: addr }).then(() => fetchPartners()).catch(alert);
                        }
                      }}
                      className="btn-outline btn-compact"
                    >
                      {t('admin.wallet')}
                    </button>
                    <button
                      onClick={() => {
                        const amt = prompt(t('admin.promptAmount'));
                        if (amt && !isNaN(parseFloat(amt))) {
                          api.admin.addPartnerBillingBalance(p.id, parseFloat(amt)).then(() => fetchPartners()).catch(alert);
                        }
                      }}
                      className="btn-outline btn-compact"
                    >
                      {t('admin.topup')}
                    </button>
                    <button
                      onClick={() => openFees(p)}
                      className="btn-outline btn-compact"
                    >
                      {t('admin.editFees')}
                    </button>
                    <button
                      onClick={() => handleRegenerate(p.id)}
                      className="btn-outline btn-compact"
                    >
                      Key
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {partners.length === 0 && <p className="muted-text empty-text">{t('admin.noPartners')}</p>}
        </div>
      )}
    </div>
  );
}
