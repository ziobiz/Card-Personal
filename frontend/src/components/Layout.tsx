import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { TNavLink, useTenantNav } from './TenantLink';
import './Layout.css';

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}
function IconIssue() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}
function IconManage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M8 14h4" />
    </svg>
  );
}
function IconEarn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10.5c.6-1 1.5-1.5 2.5-1.5s2 .6 2.2 1.6c.2 1.2-1 1.8-2.2 2.1-1.3.3-2.5.9-2.3 2.2.2 1 1.2 1.6 2.3 1.6 1.1 0 2-.6 2.5-1.5" />
    </svg>
  );
}
function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12h4l2.5-6 3 12 2-6h4" />
    </svg>
  );
}
function IconAccount() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" />
    </svg>
  );
}
function IconHelp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 4.5h9.5L19.5 8v11.5H6z" />
      <path d="M15.5 4.5V8H19.5M9 12h6M9 15.5h4.5" />
    </svg>
  );
}

export default function Layout() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const { logout } = useAuth();
  const go = useTenantNav();

  const handleLogout = () => {
    logout();
    window.location.href = go('/login');
  };

  const itemClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'on' : undefined);

  return (
    <div className="wx-shell">
      <header className="wx-top">
        <TNavLink to="/" className="wx-mark">
          {brand.logoLogin ? <img src={brand.logoLogin} alt={brand.productName} className="wx-mark-img" /> : brand.productName}
        </TNavLink>
        <LanguageSwitcher />
      </header>
      <div className="wx-frame">
        <aside className="wx-side">
          <TNavLink to="/" end className={itemClass}>
            <IconHome /> {t('nav.home')}
          </TNavLink>
          <TNavLink to="/cards/issue" className={itemClass}>
            <IconIssue /> {t('nav.cardsIssue')}
          </TNavLink>
          <TNavLink to="/cards/manage" className={itemClass}>
            <IconManage /> {t('nav.cardsManage')}
          </TNavLink>
          <TNavLink to="/earn" className={itemClass}>
            <IconEarn /> {t('nav.earn')}
          </TNavLink>
          <TNavLink to="/activity" className={itemClass}>
            <IconActivity /> {t('nav.activity')}
          </TNavLink>
          <TNavLink to="/account" className={itemClass}>
            <IconAccount /> {t('nav.account')}
          </TNavLink>
          <TNavLink to="/help" className={itemClass}>
            <IconHelp /> {t('nav.help')}
          </TNavLink>
          <button type="button" onClick={handleLogout}>
            {t('nav.logout')}
          </button>
        </aside>
        <main className="wx-main">
          <Outlet />
        </main>
      </div>
      <p className="wx-shell-copy">{brand.copyright || 'Copyright © 2026 ICOCARD Service by ONTHELINE'}</p>
      <nav className="wx-bottom" aria-label="Primary">
        <TNavLink to="/" end className={itemClass}>
          <IconHome />
          {t('nav.home')}
        </TNavLink>
        <TNavLink to="/cards/issue" className={itemClass}>
          <IconIssue />
          {t('nav.cardsIssueShort')}
        </TNavLink>
        <TNavLink to="/cards/manage" className={itemClass}>
          <IconManage />
          {t('nav.cardsManageShort')}
        </TNavLink>
        <TNavLink to="/activity" className={itemClass}>
          <IconActivity />
          {t('nav.activity')}
        </TNavLink>
        <TNavLink to="/account" className={itemClass}>
          <IconAccount />
          {t('nav.accountShort')}
        </TNavLink>
      </nav>
    </div>
  );
}
