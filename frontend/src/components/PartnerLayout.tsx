import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { api } from '../api';
import './PartnerPortal.css';

const PARTNER_MENUS: Array<{ to: string; key: string; menu: string; end?: boolean }> = [
  { to: '/partner', key: 'partner.navHome', menu: 'home', end: true },
  { to: '/partner/api', key: 'partner.navApi', menu: 'api' },
  { to: '/partner/fees', key: 'partner.navFees', menu: 'fees' },
  { to: '/partner/staff', key: 'partner.navStaff', menu: 'staff' },
  { to: '/partner/manual', key: 'partner.navManual', menu: 'manual' },
  { to: '/partner/access', key: 'partner.navAccess', menu: 'access' },
];

export default function PartnerLayout() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const loc = useLocation();
  const [allowed, setAllowed] = useState<string[] | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('partnerToken')) return;
    api.partnerPortal
      .me()
      .then((r) => setAllowed(r.allowedMenus || []))
      .catch(() => setAllowed(null));
  }, []);

  if (!localStorage.getItem('partnerToken')) {
    return <Navigate to="/partner/login" replace />;
  }
  if (localStorage.getItem('partnerOtpPending')) {
    return <Navigate to="/partner/otp" replace />;
  }
  if (localStorage.getItem('partnerMustChangePassword')) {
    return <Navigate to="/partner/password" replace />;
  }

  const visible = allowed ? PARTNER_MENUS.filter((m) => allowed.includes(m.menu)) : PARTNER_MENUS;
  const current = PARTNER_MENUS.find((m) => (m.end ? loc.pathname === m.to : loc.pathname.startsWith(m.to)));
  if (allowed && current && !allowed.includes(current.menu) && visible[0]) {
    return <Navigate to={visible[0].to} replace />;
  }

  return (
    <div className="pp-shell">
      <header className="pp-top">
        <Link to="/partner" className="pp-logo">
          {brand.logoAdmin ? <img src={brand.logoAdmin} alt="" /> : brand.productName} {t('partner.portal')}
        </Link>
        <nav className="pp-nav">
          {visible.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end}>
              {t(m.key)}
            </NavLink>
          ))}
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
