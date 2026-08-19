import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

export default function PartnerFees() {
  const { t } = useTranslation();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.partnerPortal.overview>> | null>(null);

  useEffect(() => {
    api.partnerPortal.overview().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <p className="muted-text">{t('common.loading')}</p>;
  const f = data.fees;
  return (
    <div className="pp-card">
      <h1>{t('partner.navFees')}</h1>
      <p className="muted-text">{data.feeTemplateName || t('admin.feeFollowHq')}</p>
      <table className="admin-table">
        <tbody>
          <tr><th>{t('admin.feeIssue')}</th><td>{f.cardIssuanceFee}</td></tr>
          <tr><th>{t('admin.feeTopup')}</th><td>{f.cardTopUpFeePercent}</td></tr>
          <tr><th>{t('admin.feeUsage')}</th><td>{f.cardUsageFeePerTransaction}</td></tr>
          <tr><th>{t('admin.feeMonthly')}</th><td>{f.cardMonthlyFee}</td></tr>
          <tr><th>{t('admin.feePartner')}</th><td>{f.partnerMonthlyFee}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
