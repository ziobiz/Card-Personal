import { Link, NavLink, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import './PartnerPortal.css';

export default function PartnerLayout() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  if (!localStorage.getItem('partnerToken')) {
    return <Navigate to="/partner/login" replace />;
  }
  if (localStorage.getItem('partnerOtpPending')) {
    return <Navigate to="/partner/otp" replace />;
  }
  if (localStorage.getItem('partnerMustChangePassword')) {
    return <Navigate to="/partner/password" replace />;
  }
  return (
    <div className="pp-shell">
      <header className="pp-top">
        <Link to="/partner" className="pp-logo">
          {brand.logoAdmin ? <img src={brand.logoAdmin} alt="" /> : brand.productName} {t('partner.portal')}
        </Link>
        <nav className="pp-nav">
          <NavLink to="/partner" end>{t('partner.navHome')}</NavLink>
          <NavLink to="/partner/api">{t('partner.navApi')}</NavLink>
          <NavLink to="/partner/fees">{t('partner.navFees')}</NavLink>
          <NavLink to="/partner/manual">{t('partner.navManual')}</NavLink>
        </nav>
        <LanguageSwitcher admin />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            localStorage.removeItem('partnerToken');
            localStorage.removeItem('partnerMustChangePassword');
            localStorage.removeItem('partnerOtpPending');
            window.location.href = '/partner/login';
          }}
        >
          {t('nav.logout')}
        </button>
      </header>
      <main className="pp-main">
        <Outlet />
      </main>
    </div>
  );
}
