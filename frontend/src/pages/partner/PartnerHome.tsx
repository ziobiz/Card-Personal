import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Overview = Awaited<ReturnType<typeof api.partnerPortal.overview>>;

export default function PartnerHome() {
  const { t } = useTranslation();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.partnerPortal.overview().then(setData).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="auth-error">{error}</p>;
  if (!data) return <p className="muted-text">{t('common.loading')}</p>;

  return (
    <div className="pp-card">
      <h1>{t('partner.navHome')}</h1>
      <p className="muted-text">{data.partner.companyName || data.partner.name}</p>
      <p>
        {t('admin.sectionIssueCards')}: {t(`admin.issuePolicy.${data.partner.cardIssuePolicy || 'ALL'}`)}
      </p>
      <p>
        API Base: <code>{data.apiBase}</code>
      </p>
    </div>
  );
}
