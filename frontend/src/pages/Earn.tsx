import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Earn() {
  const { t } = useTranslation();

  return (
    <div className="app-container">
      <h1 className="wx-earn-title">{t('earn.title')}</h1>
      <p className="wx-earn-lead">{t('earn.subtitle')}</p>

      <div className="wx-grid wx-grid-2" style={{ marginBottom: '1.25rem' }}>
        <div className="card-surface wx-rate-card">
          <span className="wx-rate-label">{t('earn.cashbackTitle')}</span>
          <div>
            <div className="wx-rate-num">{t('earn.cashbackRate')}</div>
            <p className="wx-rate-desc">{t('earn.cashbackDesc')}</p>
          </div>
        </div>
        <div className="card-surface wx-rate-card">
          <span className="wx-rate-label">{t('earn.saveTitle')}</span>
          <div>
            <div className="wx-rate-num">{t('earn.saveRate')}</div>
            <p className="wx-rate-desc">{t('earn.saveDesc')}</p>
          </div>
        </div>
      </div>

      <div className="card-surface">
        <h2 className="section-title">{t('earn.products')}</h2>
        <div className="wx-product">
          <div>
            <h3>{t('earn.cardSpend')}</h3>
            <p>{t('earn.cardSpendDesc')}</p>
          </div>
          <Link to="/cards/issue" className="wx-ghost">
            {t('nav.cards')}
          </Link>
        </div>
        <div className="wx-product">
          <div>
            <h3>{t('earn.walletHold')}</h3>
            <p>{t('earn.walletHoldDesc')}</p>
          </div>
          <Link to="/" className="wx-ghost">
            {t('nav.home')}
          </Link>
        </div>
        <div className="wx-product">
          <div>
            <h3>{t('earn.physical')}</h3>
            <p>{t('earn.physicalDesc')}</p>
          </div>
          <Link to="/cards/issue" className="wx-ghost">
            {t('cards.issuePlasticShort')}
          </Link>
        </div>
      </div>
    </div>
  );
}
