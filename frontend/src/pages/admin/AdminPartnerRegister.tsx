import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import {
  emptyOrgProfile,
  OrgAccountFields,
  OrgBasicFields,
  profilePayload,
  validateOrgProfile,
} from './OrgProfileFields';
import ParentOrgSearchModal, { type ParentOrg } from './ParentOrgSearchModal';
import ConfirmRegisterModal from './ConfirmRegisterModal';

const FEE_CUSTOM = '__custom';

const emptyFees = () => ({
  cardIssuanceFee: 5,
  cardTopUpFeePercent: 0.5,
  cardUsageFeePerTransaction: 0.1,
  cardMonthlyFee: 2,
  partnerMonthlyFee: 50,
  plasticIssuanceFee: 10,
});

export default function AdminPartnerRegister() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyOrgProfile());
  const [cardIssuePolicy, setCardIssuePolicy] = useState<'ALL' | 'VIRTUAL' | 'PLASTIC' | 'STOPPED'>('ALL');
  const [feePolicyId, setFeePolicyId] = useState('');
  const [customFees, setCustomFees] = useState(emptyFees());
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    isHqDefault: boolean;
    fees?: Partial<ReturnType<typeof emptyFees>>;
  }>>([]);
  const [parentOpen, setParentOpen] = useState(false);
  const [searchLevel, setSearchLevel] = useState('MERCHANT');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api.admin.getFeeTemplates().then((r) => {
      setTemplates(r.items.map((x) => ({
        id: x.id,
        name: x.name,
        isHqDefault: x.isHqDefault,
        fees: x.fees,
      })));
      const hq = r.items.find((x) => x.isHqDefault);
      if (hq?.fees) {
        setCustomFees({
          cardIssuanceFee: hq.fees.cardIssuanceFee ?? 5,
          cardTopUpFeePercent: hq.fees.cardTopUpFeePercent ?? 0.5,
          cardUsageFeePerTransaction: hq.fees.cardUsageFeePerTransaction ?? 0.1,
          cardMonthlyFee: hq.fees.cardMonthlyFee ?? 2,
          partnerMonthlyFee: hq.fees.partnerMonthlyFee ?? 50,
          plasticIssuanceFee: hq.fees.plasticIssuanceFee ?? 10,
        });
      }
    }).catch(() => setTemplates([]));
  }, []);

  const openParentSearch = (forLevel?: string) => {
    setSearchLevel(forLevel || form.orgLevel);
    setParentOpen(true);
  };

  const pickParent = (org: ParentOrg) => {
    setForm((f) => ({ ...f, parentId: org.id, parentName: `${org.name} (${org.code || org.id})` }));
    setParentOpen(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const err = validateOrgProfile(form, t);
    if (err) {
      setMessage(err);
      return;
    }
    setConfirmOpen(true);
  };

  const doCreate = async () => {
    setSaving(true);
    try {
      const payload = profilePayload(form);
      const isCustom = feePolicyId === FEE_CUSTOM;
      if (form.orgLevel === 'MERCHANT') {
        const r = await api.admin.createPartner({
          ...payload,
          cardIssuePolicy,
          feePolicyId: isCustom ? '' : feePolicyId,
          fees: isCustom ? customFees : undefined,
        });
        setApiKey(r.apiKey);
        setLoginId(r.loginId || payload.loginId);
        setOrgCode(r.orgCode || '');
      } else {
        const created = await api.admin.createOrg({
          ...payload,
          orgLevel: form.orgLevel,
        }) as { code?: string };
        setLoginId(payload.loginId);
        setOrgCode(created.code || '');
        setApiKey('');
      }
      setConfirmOpen(false);
    } catch (e2) {
      setMessage((e2 as Error).message);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (apiKey !== null) {
    return (
      <div className="card-surface">
        <h3 className="section-title">{apiKey ? t('admin.apiKeyOnce') : t('admin.orgLoginIssued')}</h3>
        <p className="muted-text">{t('admin.orgLoginIssued')}</p>
        <p>
          {t('admin.orgCode')}: <code>{orgCode || '-'}</code>
        </p>
        <p>
          {t('admin.loginId')}: <code>{loginId}</code>
        </p>
        {apiKey ? (
          <>
            <code className="admin-api-key-value">{apiKey}</code>
            <p className="muted-text">{t('admin.apiKeySave')}</p>
          </>
        ) : null}
        <div className="hq-toolbar">
          <button type="button" className="btn-primary" onClick={() => navigate('/admin/partners')}>
            {t('admin.navPartners')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="reg-page">
      <div className="card-surface reg-card">
        <h3 className="section-title">{t('admin.sectionBasic')}</h3>
        <p className="hq-card-hint">{t('admin.basicHint')}</p>
        <OrgBasicFields value={form} onChange={setForm} onSearchParent={openParentSearch} />
      </div>

      <div className="card-surface reg-card">
        <h3 className="section-title">{t('admin.sectionAccount')}</h3>
        <OrgAccountFields value={form} onChange={setForm} />
      </div>

      <div className="card-surface reg-card">
        <h3 className="section-title">{t('admin.sectionFeeCard')}</h3>
        <p className="hq-card-hint">{t('admin.feeDirectHint')}</p>
        <div className="hq-form-grid">
          <label>
            <span>{t('admin.feePolicySelect')}</span>
            <select
              className="input"
              value={feePolicyId}
              onChange={(e) => {
                const v = e.target.value;
                setFeePolicyId(v);
                if (v === FEE_CUSTOM) {
                  const hq = templates.find((x) => x.isHqDefault);
                  if (hq?.fees) {
                    setCustomFees((prev) => ({
                      ...prev,
                      cardIssuanceFee: hq.fees!.cardIssuanceFee ?? prev.cardIssuanceFee,
                      cardTopUpFeePercent: hq.fees!.cardTopUpFeePercent ?? prev.cardTopUpFeePercent,
                      cardUsageFeePerTransaction: hq.fees!.cardUsageFeePerTransaction ?? prev.cardUsageFeePerTransaction,
                      cardMonthlyFee: hq.fees!.cardMonthlyFee ?? prev.cardMonthlyFee,
                      partnerMonthlyFee: hq.fees!.partnerMonthlyFee ?? prev.partnerMonthlyFee,
                      plasticIssuanceFee: hq.fees!.plasticIssuanceFee ?? prev.plasticIssuanceFee,
                    }));
                  }
                }
              }}
            >
              <option value="">{t('admin.feeFollowHq')}</option>
              <option value={FEE_CUSTOM}>{t('admin.feeDirectInput')}</option>
              {templates.filter((x) => !x.isHqDefault).map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
          </label>
        </div>
        {feePolicyId === FEE_CUSTOM ? (
          <div className="hq-form-grid" style={{ marginTop: 10 }}>
            {([
              ['cardIssuanceFee', 'feeIssue'],
              ['cardTopUpFeePercent', 'feeTopup'],
              ['cardUsageFeePerTransaction', 'feeUsage'],
              ['cardMonthlyFee', 'feeMonthly'],
              ['partnerMonthlyFee', 'feePartner'],
              ['plasticIssuanceFee', 'feePlastic'],
            ] as const).map(([key, label]) => (
              <label key={key} className="hq-req">
                <span>{t(`admin.${label}`)}<em>*</em></span>
                <input
                  type="number"
                  className="input"
                  min={0}
                  step={0.01}
                  value={customFees[key]}
                  onChange={(e) => setCustomFees((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                />
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card-surface reg-card">
        <h3 className="section-title">{t('admin.sectionIssueCards')}</h3>
        <div className="hq-form-grid">
          <label>
            <span>{t('admin.sectionIssueCards')}</span>
            <select
              className="input"
              value={cardIssuePolicy}
              onChange={(e) => setCardIssuePolicy(e.target.value as typeof cardIssuePolicy)}
            >
              <option value="ALL">{t('admin.issuePolicy.ALL')}</option>
              <option value="VIRTUAL">{t('admin.issuePolicy.VIRTUAL')}</option>
              <option value="PLASTIC">{t('admin.issuePolicy.PLASTIC')}</option>
              <option value="STOPPED">{t('admin.issuePolicy.STOPPED')}</option>
            </select>
          </label>
        </div>
        {cardIssuePolicy === 'STOPPED' ? (
          <p className="hq-card-hint">{t('admin.issueStoppedHint')}</p>
        ) : null}
      </div>

      {message ? <p className="auth-error">{message}</p> : null}
      <div className="reg-actions">
        <Link to="/admin/partners" className="btn-secondary">{t('common.cancel')}</Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {t('admin.register')}
        </button>
      </div>

      <ParentOrgSearchModal
        open={parentOpen}
        forLevel={searchLevel}
        onClose={() => setParentOpen(false)}
        onSelect={pickParent}
      />
      <ConfirmRegisterModal
        open={confirmOpen}
        busy={saving}
        summary={`${form.name} · ${form.loginId}`}
        onClose={() => !saving && setConfirmOpen(false)}
        onConfirm={doCreate}
      />
    </form>
  );
}
