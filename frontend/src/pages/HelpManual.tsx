import { useTranslation } from 'react-i18next';
import ManualDoc from '../components/ManualDoc';

export default function HelpManual() {
  const { t } = useTranslation();
  return (
    <div className="card-surface">
      <h1 className="section-title">{t('nav.help')}</h1>
      <ManualDoc audience="customer" />
    </div>
  );
}
