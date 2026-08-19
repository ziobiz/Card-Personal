import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import './Layout.css';

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}
function IconCards() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
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

export default function Layout() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const itemClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'on' : undefined);

  return (
    <div className="wx-shell">
      <header className="wx-top">
        <NavLink to="/" className="wx-mark">
          {brand.logoLogin ? <img src={brand.logoLogin} alt={brand.productName} className="wx-mark-img" /> : brand.productName}
        </NavLink>
        <LanguageSwitcher />
      </header>
      <div className="wx-frame">
        <aside className="wx-side">
          <NavLink to="/" end className={itemClass}>
            <IconHome /> {t('nav.home')}
          </NavLink>
          <NavLink to="/cards" className={itemClass}>
            <IconCards /> {t('nav.cards')}
          </NavLink>
          <NavLink to="/earn" className={itemClass}>
            <IconEarn /> {t('nav.earn')}
          </NavLink>
          <NavLink to="/activity" className={itemClass}>
            <IconActivity /> {t('nav.activity')}
          </NavLink>
          <button type="button" onClick={handleLogout}>
            {t('nav.logout')}
          </button>
        </aside>
        <main className="wx-main">
          <Outlet />
        </main>
      </div>
      <nav className="wx-bottom" aria-label="Primary">
        <NavLink to="/" end className={itemClass}>
          <IconHome />
          {t('nav.home')}
        </NavLink>
        <NavLink to="/cards" className={itemClass}>
          <IconCards />
          {t('nav.cards')}
        </NavLink>
        <NavLink to="/earn" className={itemClass}>
          <IconEarn />
          {t('nav.earn')}
        </NavLink>
        <NavLink to="/activity" className={itemClass}>
          <IconActivity />
          {t('nav.activity')}
        </NavLink>
      </nav>
    </div>
  );
}
