import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Dist = {
  hqRate: number;
  regionalRate: number;
  masterRate: number;
  branchRate: number;
  agencyRate: number;
  salesOfficeRate: number;
  hqPerTxFee: number;
  regionalPerTxFee: number;
  masterPerTxFee: number;
  branchPerTxFee: number;
  agencyPerTxFee: number;
  salesOfficePerTxFee: number;
};

type Row = {
  id: string;
  name: string;
  companyName?: string;
  status: string;
  distribution: Dist;
  distributionApplyStart?: string;
};

const emptyDist = (): Dist => ({
  hqRate: 0,
  regionalRate: 0,
  masterRate: 0,
  branchRate: 0,
  agencyRate: 0,
  salesOfficeRate: 0,
  hqPerTxFee: 0,
  regionalPerTxFee: 0,
  masterPerTxFee: 0,
  branchPerTxFee: 0,
  agencyPerTxFee: 0,
  salesOfficePerTxFee: 0,
});

const LEVELS: Array<{ rate: keyof Dist; fee: keyof Dist; label: string }> = [
  { rate: 'hqRate', fee: 'hqPerTxFee', label: 'HEADQUARTERS' },
  { rate: 'regionalRate', fee: 'regionalPerTxFee', label: 'REGIONAL' },
  { rate: 'masterRate', fee: 'masterPerTxFee', label: 'MASTER_DIST' },
  { rate: 'branchRate', fee: 'branchPerTxFee', label: 'BRANCH' },
  { rate: 'agencyRate', fee: 'agencyPerTxFee', label: 'AGENCY' },
  { rate: 'salesOfficeRate', fee: 'salesOfficePerTxFee', label: 'SALES_OFFICE' },
];

export default function AdminFeePolicy({ view = 'all' }: { view?: 'list' | 'manage' | 'all' }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [qName, setQName] = useState('');
  const [qCode, setQCode] = useState('');
  const [qStatus, setQStatus] = useState('all');
  const [message, setMessage] = useState('');
  const [showDefault, setShowDefault] = useState(false);
  const [defaults, setDefaults] = useState(emptyDist());
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    isHqDefault: boolean;
    fees: {
      cardIssuanceFee?: number;
      cardTopUpFeePercent?: number;
      cardUsageFeePerTransaction?: number;
      cardMonthlyFee?: number;
      partnerMonthlyFee?: number;
      plasticIssuanceFee?: number;
    };
  }>>([]);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [editTpl, setEditTpl] = useState<string | null>(null);
  const [tplFees, setTplFees] = useState({
    cardIssuanceFee: 5,
    cardTopUpFeePercent: 0.5,
    cardUsageFeePerTransaction: 0.1,
    cardMonthlyFee: 2,
    partnerMonthlyFee: 50,
    plasticIssuanceFee: 15,
  });

  const load = () => {
    Promise.all([api.admin.getPartners(), api.admin.getSalesFeePolicy(), api.admin.getFeeTemplates()])
      .then(([p, policy, tpls]) => {
        const base = { ...emptyDist(), ...(policy.distribution ?? {}) };
        setDefaults(base);
        setTemplates(tpls.items);
        setRows(
          p.items.map((it) => ({
            id: it.id,
            name: it.name,
            companyName: it.companyName,
            status: it.status,
            distribution: { ...base, ...((it as { distribution?: Dist }).distribution ?? {}) },
            distributionApplyStart: (it as { distributionApplyStart?: string }).distributionApplyStart,
          }))
        );
      })
      .catch((e) => setMessage((e as Error).message));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (qStatus !== 'all' && r.status !== qStatus) return false;
        if (qName && !`${r.name} ${r.companyName ?? ''}`.toLowerCase().includes(qName.toLowerCase())) return false;
        if (qCode && !r.id.toLowerCase().includes(qCode.toLowerCase())) return false;
        return true;
      }),
    [rows, qName, qCode, qStatus]
  );

  const patch = (id: string, key: keyof Dist, value: number) => {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, distribution: { ...r.distribution, [key]: value } } : r)));
  };

  const saveRow = async (r: Row) => {
    setMessage('');
    try {
      await api.admin.updatePartner(r.id, {
        distribution: r.distribution,
        distributionApplyStart: r.distributionApplyStart,
      });
      setMessage(t('admin.saved'));
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const saveAll = async () => {
    setMessage('');
    try {
      await Promise.all(filtered.map((r) => api.admin.updatePartner(r.id, { distribution: r.distribution, distributionApplyStart: r.distributionApplyStart })));
      setMessage(t('admin.saved'));
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const saveDefaults = async () => {
    try {
      await api.admin.updateSalesFeePolicy({ distribution: defaults });
      setShowDefault(false);
      load();
      setMessage(t('admin.saved'));
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const num = (v: string) => parseFloat(v) || 0;

  return (
    <div>
      {view !== 'manage' && <div className="hq-filter">
        <label>
          {t('admin.filterUse')}
          <select className="input" value={qStatus} onChange={(e) => setQStatus(e.target.value)}>
            <option value="all">{t('admin.filterAll')}</option>
            <option value="active">{t('admin.statusActive')}</option>
            <option value="suspended">{t('admin.statusSuspended')}</option>
          </select>
        </label>
        <label>
          {t('admin.colPartner')}
          <input className="input" value={qName} onChange={(e) => setQName(e.target.value)} />
        </label>
        <label>
          {t('admin.filterCode')}
          <input className="input" value={qCode} onChange={(e) => setQCode(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" onClick={load}>
          {t('admin.search')}
        </button>
      </div>}

      {view !== 'manage' && <div className="hq-toolbar">
        <button type="button" className="btn-secondary" onClick={() => setShowDefault(true)}>
          {t('admin.feeSetting')}
        </button>
        <button type="button" className="btn-primary" onClick={saveAll}>
          {t('admin.save')}
        </button>
      </div>}
      {message && <p className="muted-text">{message}</p>}

      {view !== 'list' && <div className="card-surface" style={{ marginBottom: 12 }}>
        <h3 className="section-title">{t('admin.feeTemplates')}</h3>
        <p className="muted-text">{t('admin.feeTemplatesDesc')}</p>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.brandProduct')}</th>
              <th>{t('admin.feeIssue')}</th>
              <th>{t('admin.feeTopup')}</th>
              <th>{t('admin.feeUsage')}</th>
              <th>{t('admin.feeMonthly')}</th>
              <th>{t('admin.feePartner')}</th>
              <th>{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => (
              <tr key={tpl.id}>
                <td>
                  {tpl.name}
                  {tpl.isHqDefault ? <div className="muted-text">{t('admin.feeHqDefault')}</div> : null}
                </td>
                <td>{tpl.fees.cardIssuanceFee}</td>
                <td>{tpl.fees.cardTopUpFeePercent}</td>
                <td>{tpl.fees.cardUsageFeePerTransaction}</td>
                <td>{tpl.fees.cardMonthlyFee}</td>
                <td>{tpl.fees.partnerMonthlyFee}</td>
                <td>
                  <button type="button" className="btn-outline" onClick={() => {
                    setEditTpl(tpl.id);
                    setTplName(tpl.name);
                    setTplDesc(tpl.description || '');
                    setTplFees({
                      cardIssuanceFee: tpl.fees.cardIssuanceFee ?? 5,
                      cardTopUpFeePercent: tpl.fees.cardTopUpFeePercent ?? 0.5,
                      cardUsageFeePerTransaction: tpl.fees.cardUsageFeePerTransaction ?? 0.1,
                      cardMonthlyFee: tpl.fees.cardMonthlyFee ?? 2,
                      partnerMonthlyFee: tpl.fees.partnerMonthlyFee ?? 50,
                      plasticIssuanceFee: tpl.fees.plasticIssuanceFee ?? 15,
                    });
                  }}>{t('common.change')}</button>
                  {!tpl.isHqDefault && (
                    <button type="button" className="btn-outline" onClick={async () => {
                      await api.admin.deleteFeeTemplate(tpl.id);
                      load();
                    }}>{t('admin.brandClear')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hq-toolbar" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
          <button type="button" className="btn-secondary" onClick={() => setShowDefault(true)}>
            {t('admin.feeSetting')}
          </button>
          <button type="button" className="btn-primary" onClick={() => {
            setEditTpl('new');
            setTplName('');
            setTplDesc('');
          }}>{t('admin.feeTemplateAdd')}</button>
        </div>
        {(editTpl === 'new' || (editTpl && editTpl !== 'new')) && (
          <div className="hq-filter" style={{ marginTop: 8 }}>
            <label>
              {t('admin.feeTemplateName')}
              <input className="input" value={tplName} onChange={(e) => setTplName(e.target.value)} />
            </label>
            {(['cardIssuanceFee', 'cardTopUpFeePercent', 'cardUsageFeePerTransaction', 'cardMonthlyFee', 'partnerMonthlyFee', 'plasticIssuanceFee'] as const).map((k) => (
              <label key={k}>
                {k}
                <input className="input" type="number" value={tplFees[k]} onChange={(e) => setTplFees((f) => ({ ...f, [k]: Number(e.target.value) || 0 }))} />
              </label>
            ))}
            <button type="button" className="btn-primary" onClick={async () => {
              if (editTpl === 'new') await api.admin.createFeeTemplate({ name: tplName, description: tplDesc, fees: tplFees });
              else if (editTpl) await api.admin.updateFeeTemplate(editTpl, { name: tplName, description: tplDesc, fees: tplFees });
              setEditTpl(null);
              load();
              setMessage(t('admin.saved'));
            }}>{t('admin.save')}</button>
            <button type="button" className="btn-secondary" onClick={() => setEditTpl(null)}>{t('common.cancel')}</button>
          </div>
        )}
      </div>}

      {showDefault && (
        <div className="card-surface admin-partners-create" style={{ maxWidth: 560, marginBottom: 12 }}>
          <h3>{t('admin.feeSetting')}</h3>
          <p className="muted-text">{t('admin.distFeesDesc')}</p>
          {LEVELS.map((lv) => (
            <div key={lv.label} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 120 }}>{t(`admin.orgLevel.${lv.label}`)}</span>
              <input className="input" type="number" value={defaults[lv.rate]} onChange={(e) => setDefaults((d) => ({ ...d, [lv.rate]: num(e.target.value) }))} />
              <span>%</span>
              <input className="input" type="number" value={defaults[lv.fee]} onChange={(e) => setDefaults((d) => ({ ...d, [lv.fee]: num(e.target.value) }))} />
            </div>
          ))}
          <button type="button" className="btn-primary" onClick={saveDefaults}>{t('admin.save')}</button>
          {' '}
          <button type="button" className="btn-secondary" onClick={() => setShowDefault(false)}>{t('common.cancel')}</button>
        </div>
      )}

      {view !== 'manage' && <div className="card-surface" style={{ overflowX: 'auto', padding: 0 }}>
        <table className="admin-table hq-fee-table">
          <thead>
            <tr>
              <th rowSpan={2}>No.</th>
              <th rowSpan={2}>{t('admin.colPartner')}</th>
              <th rowSpan={2}>{t('admin.filterCode')}</th>
              {LEVELS.map((lv) => (
                <th key={lv.label} colSpan={2} className="hq-group-head">{t(`admin.orgLevel.${lv.label}`)}</th>
              ))}
              <th colSpan={2} className="hq-group-head">{t('admin.colTotal')}</th>
              <th rowSpan={2}>{t('admin.colActions')}</th>
              <th rowSpan={2}>{t('admin.applyStart')}</th>
            </tr>
            <tr>
              {LEVELS.flatMap((lv) => [
                <th key={lv.rate}>{t('admin.colRate')}</th>,
                <th key={lv.fee}>{t('admin.colPerTx')}</th>,
              ])}
              <th>{t('admin.colRate')}</th>
              <th>{t('admin.colPerTx')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const rateSum = LEVELS.reduce((s, lv) => s + (Number(r.distribution[lv.rate]) || 0), 0);
              const feeSum = LEVELS.reduce((s, lv) => s + (Number(r.distribution[lv.fee]) || 0), 0);
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.companyName || r.name}</td>
                  <td className="mono">{r.id}</td>
                  {LEVELS.map((lv) => (
                    <FragmentCells key={lv.label} r={r} lv={lv} patch={patch} num={num} />
                  ))}
                  <td>{rateSum.toFixed(2)}</td>
                  <td>{feeSum.toFixed(2)}</td>
                  <td>
                    <button type="button" className="btn-primary btn-save" onClick={() => saveRow(r)}>{t('admin.save')}</button>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={r.distributionApplyStart?.slice(0, 10) || ''}
                      onChange={(e) =>
                        setRows((list) => list.map((x) => (x.id === r.id ? { ...x, distributionApplyStart: e.target.value } : x)))
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

function FragmentCells({
  r,
  lv,
  patch,
  num,
}: {
  r: Row;
  lv: { rate: keyof Dist; fee: keyof Dist; label: string };
  patch: (id: string, key: keyof Dist, value: number) => void;
  num: (v: string) => number;
}) {
  return (
    <>
      <td>
        <input type="number" value={r.distribution[lv.rate]} onChange={(e) => patch(r.id, lv.rate, num(e.target.value))} />
      </td>
      <td>
        <input type="number" value={r.distribution[lv.fee]} onChange={(e) => patch(r.id, lv.fee, num(e.target.value))} />
      </td>
    </>
  );
}
