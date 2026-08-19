import { useTranslation } from 'react-i18next';

export default function PartnerManual() {
  const { t } = useTranslation();
  return (
    <div className="pp-card">
      <h1>{t('partner.navManual')}</h1>
      <ol>
        <li>{t('partner.manual1')}</li>
        <li>{t('partner.manual2')}</li>
        <li>{t('partner.manual3')}</li>
        <li>{t('partner.manual4')}</li>
      </ol>
    </div>
  );
}
