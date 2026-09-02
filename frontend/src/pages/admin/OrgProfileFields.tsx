import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { JapanPostcodeModal, loadDaumPostcode, openKoreaPostcode } from './ZipSearch';

export const ORG_LEVELS_REG = ['REGIONAL', 'MASTER_DIST', 'BRANCH', 'AGENCY', 'SALES_OFFICE', 'MERCHANT'] as const;

export type OrgProfileValues = {
  orgLevel: string;
  code: string;
  parentId: string;
  parentName: string;
  name: string;
  bizKind: string;
  businessNo: string;
  bizType: string;
  bizItem: string;
  ceoName: string;
  mobile: string;
  phone: string;
  fax: string;
  email: string;
  country: string;
  zip: string;
  address: string;
  addressDetail: string;
  loginId: string;
  password: string;
  passwordConfirm: string;
};

export const emptyOrgProfile = (parentId = '', parentName = ''): OrgProfileValues => ({
  orgLevel: 'MERCHANT',
  code: '',
  parentId,
  parentName,
  name: '',
  bizKind: '법인',
  businessNo: '',
  bizType: '',
  bizItem: '',
  ceoName: '',
  mobile: '',
  phone: '',
  fax: '',
  email: '',
  country: 'KR',
  zip: '',
  address: '',
  addressDetail: '',
  loginId: '',
  password: '',
  passwordConfirm: '',
});

export function profilePayload(v: OrgProfileValues) {
  return {
    orgLevel: v.orgLevel,
    code: v.code.trim() || undefined,
    parentId: v.parentId,
    orgParentId: v.parentId,
    name: v.name.trim(),
    companyName: v.name.trim(),
    bizKind: v.bizKind,
    businessNo: v.businessNo.trim() || undefined,
    bizType: v.bizType.trim() || undefined,
    bizItem: v.bizItem.trim() || undefined,
    ceoName: v.ceoName.trim() || undefined,
    mobile: v.mobile.trim() || undefined,
    phone: v.phone.trim() || undefined,
    fax: v.fax.trim() || undefined,
    email: v.email.trim() || undefined,
    country: v.country,
    zip: v.zip.trim() || undefined,
    address: v.address.trim() || undefined,
    addressDetail: v.addressDetail.trim() || undefined,
    loginId: v.loginId.trim().toLowerCase(),
    password: v.password,
  };
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`${required ? 'hq-req' : ''} ${className || ''}`.trim()}>
      <span>
        {label}
        {required ? <em>*</em> : null}
      </span>
      {children}
    </label>
  );
}

const COUNTRY_CODES = ['KR', 'JP', 'US', 'CN', 'TH', 'GB'] as const;

const DIAL_CODES = [
  { id: 'KR', label: 'South Korea (+82)' },
  { id: 'JP', label: 'Japan (+81)' },
  { id: 'US', label: 'United States (+1)' },
  { id: 'CN', label: 'China (+86)' },
  { id: 'TH', label: 'Thailand (+66)' },
];

function ComboPhone({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="org-combo">
      <select className="input input-dial" defaultValue="KR" tabIndex={-1} aria-hidden>
        {DIAL_CODES.map((d) => (
          <option key={d.id} value={d.id}>{d.label}</option>
        ))}
      </select>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

export function validateOrgProfile(v: OrgProfileValues, t: (k: string) => string): string | null {
  if (!v.orgLevel) return t('admin.orgLevelRequired');
  if (!v.parentId) return t('admin.parentRequired');
  if (!v.name.trim()) return t('admin.orgNameRequired');
  if (!v.businessNo.trim()) return t('admin.bizNoRequired');
  if (!v.ceoName.trim()) return t('admin.ceoRequired');
  if (!v.mobile.trim()) return t('admin.mobileRequired');
  if (!v.phone.trim()) return t('admin.phoneRequired');
  if (!v.email.trim()) return t('admin.emailRequired');
  if (!v.zip.trim()) return t('admin.zipRequired');
  if (!v.address.trim()) return t('admin.addressRequired');
  if (!v.loginId.trim()) return t('admin.loginIdRequired');
  if (v.password.length < 8) return t('admin.passwordMin');
  if (v.password !== v.passwordConfirm) return t('admin.passwordMismatch');
  return null;
}

export function OrgAccountFields({
  value,
  onChange,
}: {
  value: OrgProfileValues;
  onChange: (next: OrgProfileValues) => void;
}) {
  const { t } = useTranslation();
  const [idMsg, setIdMsg] = useState('');
  const set = (patch: Partial<OrgProfileValues>) => onChange({ ...value, ...patch });

  const checkId = async () => {
    setIdMsg('');
    if (!value.loginId.trim()) {
      setIdMsg(t('admin.loginIdRequired'));
      return;
    }
    try {
      const r = await api.admin.checkLoginId(value.loginId.trim());
      setIdMsg(r.available ? t('admin.loginIdOk') : t('admin.loginIdDup'));
    } catch (e) {
      setIdMsg((e as Error).message);
    }
  };

  return (
    <div className="org-profile-grid org-account-row">
      <Field label={t('admin.loginId')} required>
        <div className="org-id-row">
          <input className="input" value={value.loginId} onChange={(e) => set({ loginId: e.target.value })} required />
          <button type="button" className="btn-secondary" onClick={checkId}>
            {t('admin.checkDup')}
          </button>
        </div>
        {idMsg ? <span className="muted-text">{idMsg}</span> : null}
      </Field>
      <Field label={t('admin.password')} required>
        <div className="org-id-row">
          <input className="input" type="password" value={value.password} onChange={(e) => set({ password: e.target.value })} required />
          <span className="muted-text org-pw-hint">{t('admin.passwordHint')}</span>
        </div>
      </Field>
      <Field label={t('admin.passwordConfirm')} required>
        <input className="input" type="password" value={value.passwordConfirm} onChange={(e) => set({ passwordConfirm: e.target.value })} required />
      </Field>
    </div>
  );
}

export function OrgBasicFields({
  value,
  onChange,
  onSearchParent,
  lockLevel,
  showCode,
}: {
  value: OrgProfileValues;
  onChange: (next: OrgProfileValues) => void;
  onSearchParent: (forLevel?: string) => void;
  lockLevel?: boolean;
  showCode?: boolean;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<OrgProfileValues>) => onChange({ ...value, ...patch });
  const [jpZipOpen, setJpZipOpen] = useState(false);
  const zipSearchable = value.country === 'KR' || value.country === 'JP';

  useEffect(() => {
    if (value.country === 'KR') {
      void loadDaumPostcode().catch(() => {});
    }
  }, [value.country]);

  const openZipSearch = () => {
    if (value.country === 'KR') {
      void openKoreaPostcode((zip, address) => set({ zip, address })).catch(() => {
        window.alert(t('admin.zipSearchFail'));
      });
      return;
    }
    if (value.country === 'JP') setJpZipOpen(true);
  };

  return (
    <div className="org-profile-grid org-basic-grid">
      <div className="org-row">
      <Field label={t('admin.orgParent')}>
        <div className="org-id-row">
          <input
            className="input"
            value={value.parentName}
            readOnly
            placeholder={t('admin.parentSearchPh')}
            onClick={() => onSearchParent()}
          />
          <button type="button" className="btn-secondary" onClick={() => onSearchParent()}>
            {t('admin.search')}
          </button>
        </div>
      </Field>
      <Field label={t('admin.orgLevelLabel')} required>
        {lockLevel ? (
          <input className="input" value={t(`admin.orgLevel.${value.orgLevel}`)} readOnly />
        ) : (
          <select
            className="input"
            value={value.orgLevel}
            onChange={(e) => {
              const next = e.target.value;
              set({ orgLevel: next, parentId: '', parentName: '' });
              onSearchParent(next);
            }}
          >
            {ORG_LEVELS_REG.map((code) => (
              <option key={code} value={code}>
                {t(`admin.orgLevel.${code}`)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t('admin.orgName')} required>
        <input className="input" value={value.name} onChange={(e) => set({ name: e.target.value })} required />
      </Field>
      <Field label={t('admin.businessNo')} required className="org-bizno">
        <div className="org-combo">
          <select className="input input-dial" value={value.bizKind} onChange={(e) => set({ bizKind: e.target.value })}>
            <option value="법인">{t('admin.bizCorp')}</option>
            <option value="개인">{t('admin.bizPerson')}</option>
          </select>
          <input className="input" value={value.businessNo} onChange={(e) => set({ businessNo: e.target.value })} required />
        </div>
      </Field>
      <div className="org-biz-pair">
        <Field label={t('admin.bizType')}>
          <input className="input" value={value.bizType} onChange={(e) => set({ bizType: e.target.value })} />
        </Field>
        <Field label={t('admin.bizItem')}>
          <input className="input" value={value.bizItem} onChange={(e) => set({ bizItem: e.target.value })} />
        </Field>
      </div>
      </div>
      <div className="org-row">
      <Field label={t('admin.ceoName')} required>
        <input className="input" value={value.ceoName} onChange={(e) => set({ ceoName: e.target.value })} />
      </Field>
      <Field label={t('admin.mobile')} required>
        <ComboPhone value={value.mobile} onChange={(mobile) => set({ mobile })} required />
      </Field>
      <Field label={t('admin.companyPhone')} required>
        <ComboPhone value={value.phone} onChange={(phone) => set({ phone })} required />
      </Field>
      <Field label={t('admin.fax')}>
        <ComboPhone value={value.fax} onChange={(fax) => set({ fax })} />
      </Field>
      <Field label={t('admin.colEmail')} required>
        <input className="input" type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      </div>
      <div className="org-row">
      <Field label={t('admin.country')}>
        <select className="input" value={value.country} onChange={(e) => set({ country: e.target.value })}>
          {COUNTRY_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`admin.countryName.${code}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('admin.zip')} required>
        <div className="org-id-row">
          <input className="input" value={value.zip} onChange={(e) => set({ zip: e.target.value })} required />
          {zipSearchable ? (
            <button type="button" className="btn-secondary" onClick={openZipSearch}>
              {t('admin.search')}
            </button>
          ) : null}
        </div>
      </Field>
      <Field label={t('admin.address')} required className="org-addr">
        <input className="input" value={value.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <Field label={t('admin.addressDetail')} className="org-addr">
        <input className="input" value={value.addressDetail} onChange={(e) => set({ addressDetail: e.target.value })} />
      </Field>
      {showCode ? (
        <Field label={t('admin.orgCode')}>
          <input className="input" value={value.code} readOnly />
        </Field>
      ) : null}
      </div>
      <JapanPostcodeModal
        open={jpZipOpen}
        initialQuery={value.zip}
        onClose={() => setJpZipOpen(false)}
        onPick={(zip, address) => set({ zip, address })}
      />
    </div>
  );
}
