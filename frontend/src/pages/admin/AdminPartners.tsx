import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type CredentialKit } from '../../api';
import { kickToAdminLogin } from '../../lib/adminSession';
import CredentialKitCard from '../../components/CredentialKitCard';
import { EntityFilterBar } from '../../components/EntityFilterBar';
import { useHqConfirm } from '../../components/ConfirmActionContext';
import { EMPTY_ENTITY_FILTER, filterByEntity, type EntityFilterState } from '../../lib/dateRange';

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
  mid?: string;
  deliveryMode?: 'api' | 'sub_solution' | 'sub_solution_standalone';
  walletPolicySource?: 'follow_hq' | 'custom';
  walletModes?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
  canRedistributeKeys?: boolean;
  wirexConfigured?: boolean;
  solutionSlug?: string;
  solutionUrl?: string;
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
  const { confirmSave, confirmApply } = useHqConfirm();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; isHqDefault: boolean }>>([]);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [kit, setKit] = useState<CredentialKit | null>(null);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const [feePartner, setFeePartner] = useState<Partner | null>(null);
  const [applied, setApplied] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);
  const [draft, setDraft] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);
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
        if (msg.includes('Admin') || msg.includes('403') || msg.includes('Unauthorized')) {
          kickToAdminLogin();
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPartners();
    api.admin.getFeeTemplates().then((r) => setTemplates(r.items)).catch(() => setTemplates([]));
  }, []);

  const handleRegenerate = async (id: string) => {
    if (!(await confirmApply(t('admin.confirmRegen')))) return;
    setMessage('');
    setMessageOk(false);
    try {
      const r = await api.admin.regeneratePartnerKey(id);
      setNewApiKey(r.apiKey);
      setKit(r.kit || null);
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
    if (!(await confirmSave())) return;
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
    if (!(await confirmApply())) return;
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
    if (!(await confirmApply())) return;
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

  const filtered = useMemo(
    () =>
      filterByEntity(partners, applied, {
        date: (p) => p.createdAt,
        status: (p) => p.status,
        text: (p, field) => {
          if (field === 'name') return p.name;
          if (field === 'company') return p.companyName || '';
          if (field === 'code') return p.id;
          if (field === 'mid') return p.mid || '';
          return `${p.name} ${p.companyName || ''} ${p.id} ${p.mid || ''} ${p.apiKeyPrefix}`;
        },
      }),
    [partners, applied]
  );

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

      <p className="hq-card-hint">{t('admin.partnersDesc')}</p>
      <EntityFilterBar
        value={draft}
        onChange={setDraft}
        onSearch={() => setApplied(draft)}
        onReset={() => setApplied(EMPTY_ENTITY_FILTER)}
        dateFieldOptions={[{ value: 'createdAt', label: t('admin.colJoined') }]}
        searchFieldOptions={[
          { value: 'all', label: t('admin.filterAll') },
          { value: 'name', label: t('admin.colPartner') },
          { value: 'company', label: t('admin.colCompany') },
          { value: 'code', label: t('admin.filterCode') },
          { value: 'mid', label: 'MID' },
        ]}
        statusOptions={[
          { value: 'active', label: t('admin.statusActive') },
          { value: 'suspended', label: t('admin.statusSuspended') },
        ]}
      />
      <p className="entity-filter-count">{t('admin.filterCount', { n: filtered.length })}</p>

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

      {kit ? (
        <CredentialKitCard
          kit={kit}
          title={t('admin.kitOnce')}
          hint={t('admin.kitSave')}
          closeLabel={t('common.confirm')}
          onClose={() => {
            setKit(null);
            setNewApiKey(null);
          }}
        />
      ) : newApiKey ? (
        <div className="card-surface admin-api-key-modal">
          <h3>{t('admin.apiKeyOnce')}</h3>
          <code className="admin-api-key-value">{newApiKey}</code>
          <p className="muted-text">{t('admin.apiKeySave')}</p>
          <button onClick={() => setNewApiKey(null)} className="btn-primary">
            {t('common.confirm')}
          </button>
        </div>
      ) : null}

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
          <strong>{t('admin.authLabel')}</strong> <code>X-API-Key</code> + <code>X-API-Secret</code> ({t('admin.ourKeysNotWirex')})
          <br />
          HMAC: <code>X-ICO-Timestamp</code> <code>X-ICO-Signature</code> <code>X-ICO-Mid</code>
          <br />
          <strong>{t('admin.userIdLabel')}</strong> <code>X-Partner-User-Id</code>
        </p>
      </div>

      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <h3>{t('admin.partnerList')}</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colPartner')}</th>
                <th>{t('admin.colCompany')}</th>
                <th>MID</th>
                <th>{t('admin.deliveryMode')}</th>
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
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.companyName || '-'}</td>
                  <td className="mono">{p.mid || '-'}</td>
                  <td>
                    <select
                      className="input"
                      value={p.deliveryMode || 'api'}
                      onChange={async (e) => {
                        await api.admin.updatePartner(p.id, { deliveryMode: e.target.value as 'api' | 'sub_solution' | 'sub_solution_standalone' });
                        fetchPartners();
                      }}
                    >
                      <option value="api">{t('admin.deliveryApi')}</option>
                      <option value="sub_solution">{t('admin.deliverySub')}</option>
                      <option value="sub_solution_standalone">{t('admin.deliveryStandalone')}</option>
                    </select>
                    <select
                      className="input"
                      value={p.walletPolicySource || 'follow_hq'}
                      onChange={async (e) => {
                        const src = e.target.value as 'follow_hq' | 'custom';
                        await api.admin.updatePartner(p.id, {
                          walletPolicySource: src,
                          ...(src === 'custom'
                            ? { walletModes: p.walletModes || { embedded: true, externalEoa: true, bridge: true } }
                            : {}),
                        });
                        fetchPartners();
                      }}
                    >
                      <option value="follow_hq">{t('admin.walletFollowHq')}</option>
                      <option value="custom">{t('admin.walletCustom')}</option>
                    </select>
                    {p.walletPolicySource === 'custom' ? (
                      <div className="muted-text">
                        {(['embedded', 'externalEoa', 'bridge'] as const).map((key) => (
                          <label key={key} style={{ display: 'block' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(p.walletModes?.[key])}
                              onChange={async (e) => {
                                await api.admin.updatePartner(p.id, {
                                  walletPolicySource: 'custom',
                                  walletModes: { ...p.walletModes, [key]: e.target.checked },
                                });
                                fetchPartners();
                              }}
                            />{' '}
                            {key === 'embedded' ? t('walletMode.embedded') : key === 'externalEoa' ? t('walletMode.external') : t('walletMode.bridge')}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="muted-text">{t('admin.walletFollowHq')}</div>
                    )}
                    {p.solutionUrl ? (
                      <div className="muted-text">
                        <code>{p.solutionUrl}</code>
                      </div>
                    ) : null}
                  </td>
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
                      value={p.customFees ? '__custom' : p.feePolicyId || ''}
                      onChange={async (e) => {
                        const v = e.target.value;
                        if (v === '__custom') return;
                        await api.admin.updatePartner(p.id, { feePolicyId: v, resetFees: true });
                        fetchPartners();
                      }}
                    >
                      <option value="">{t('admin.feeFollowHq')}</option>
                      {templates
                        .filter((x) => !x.isHqDefault)
                        .map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      {p.customFees && <option value="__custom">{t('admin.feesCustom')}</option>}
                    </select>
                  </td>
                  <td>
                    <select value={p.status} onChange={(e) => handleStatusChange(p.id, e.target.value)} className="admin-status-select">
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
                    <button onClick={() => openFees(p)} className="btn-outline btn-compact">
                      {t('admin.editFees')}
                    </button>
                    {p.deliveryMode === 'sub_solution_standalone' ? (
                      <button
                        onClick={async () => {
                          const clientId = prompt('Wirex Client ID');
                          const clientSecret = clientId ? prompt('Wirex Client Secret') : null;
                          if (!clientId || !clientSecret) return;
                          try {
                            await api.admin.setStandaloneWirex(p.id, { clientId, clientSecret });
                            setMessage(t('admin.standaloneWirexSaved'));
                            setMessageOk(true);
                            fetchPartners();
                          } catch (err) {
                            setMessage((err as Error).message);
                            setMessageOk(false);
                          }
                        }}
                        className="btn-outline btn-compact"
                      >
                        Wirex
                      </button>
                    ) : (
                      <button onClick={() => handleRegenerate(p.id)} className="btn-outline btn-compact">
                        Key
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="muted-text empty-text">{t('admin.noPartners')}</p>}
        </div>
      )}
    </div>
  );
}
