import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../../brand/BrandContext';
import { tokenEmail } from '../../components/AdminLayout';

export default function AdminMyInfo() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const email = useMemo(() => tokenEmail(), []);
  const [message, setMessage] = useState('');

  return (
    <div className="card-surface" style={{ maxWidth: 560 }}>
      <h3 className="section-title">{t('admin.myInfo')}</h3>
      <p className="muted-text">{t('admin.myInfoDesc')}</p>
      <div className="hq-filter" style={{ background: 'transparent', border: 0, padding: 0 }}>
        <label>
          {t('admin.colEmail')}
          <input className="input" value={email} readOnly />
        </label>
        <label>
          {t('admin.brandOperator')}
          <input className="input" value={`${brand.operatorName} HQ`} readOnly />
        </label>
        <label>
          {t('admin.roleAdmin')}
          <input className="input" value={t('admin.roleAdmin')} readOnly />
        </label>
      </div>
      {message ? <p className="muted-text">{message}</p> : null}
      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: 12 }}
        onClick={() => setMessage(t('admin.myInfoSaved'))}
      >
        {t('admin.save')}
      </button>
    </div>
  );
}
