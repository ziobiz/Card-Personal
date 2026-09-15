import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ManualDoc, { type ManualAudience } from '../../components/ManualDoc';

const TABS: ManualAudience[] = ['customer', 'api', 'sub', 'standalone'];

export default function AdminManuals() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ManualAudience>('customer');

  return (
    <div>
      <p className="hq-card-hint">{t('manual.hqLead')}</p>
      <p className="hq-card-hint">{t('manual.aclLater')}</p>
      <div className="hq-toolbar" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab(id)}
          >
            {t(`manual.${id}.title`)}
          </button>
        ))}
      </div>
      <div className="card-surface">
        <ManualDoc audience={tab} showCustomerAlso={tab !== 'customer'} />
      </div>
    </div>
  );
}
