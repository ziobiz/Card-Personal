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
      {data.credentials ? (
        <>
          <p>MID: <code>{data.credentials.mid}</code></p>
          <p>
            {t('admin.deliveryMode')}:{' '}
            {data.credentials.deliveryMode === 'sub_solution_standalone'
              ? t('admin.deliveryStandalone')
              : data.credentials.deliveryMode === 'sub_solution'
                ? t('admin.deliverySub')
                : t('admin.deliveryApi')}
          </p>
          {data.credentials.solutionUrl ? <p>URL: <a href={data.credentials.solutionUrl}>{data.credentials.solutionUrl}</a></p> : null}
          {data.credentials.deliveryMode === 'sub_solution_standalone' ? (
            <p className="muted-text">{t('partner.standaloneHint')}</p>
          ) : (
            <p className="muted-text">{t('partner.ourKeysNotWirex')}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
