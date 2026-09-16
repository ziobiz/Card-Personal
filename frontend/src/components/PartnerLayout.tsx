import { Link, NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { type LanguageCode } from '../i18n';
import { useBrand } from '../brand/BrandContext';
import { api, resolveAdminShellLogo } from '../api';
import { ConfirmActionProvider } from './ConfirmActionContext';
import './AdminLayout.css';
import './PartnerPortal.css';

const PARTNER_MENUS: Array<{ to: string; key: string; menu: string; end?: boolean }> = [
  { to: '/partner', key: 'partner.navHome', menu: 'home', end: true },
  { to: '/partner/api', key: 'partner.navApi', menu: 'api' },
  { to: '/partner/fees', key: 'partner.navFees', menu: 'fees' },
  { to: '/partner/staff', key: 'partner.navStaff', menu: 'staff' },
  { to: '/partner/manual', key: 'partner.navManual', menu: 'manual' },
  { to: '/partner/access', key: 'partner.navAccess', menu: 'access' },
];

type OpenTab = { to: string; labelKey: string };

export default function PartnerLayout() {
  const { t, i18n } = useTranslation();
  const { brand } = useBrand();
  const loc = useLocation();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [userMenuPos, setUserMenuPos] = useState<{ top: number; right: number } | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([{ to: '/partner', labelKey: 'partner.navHome' }]);
  const hasToken = Boolean(localStorage.getItem('partnerToken'));
  const otpPending = Boolean(localStorage.getItem('partnerOtpPending'));
  const mustChange = Boolean(localStorage.getItem('partnerMustChangePassword'));

  useEffect(() => {
    if (!hasToken) return;
    api.partnerPortal
      .me()
      .then((r) => setAllowed(r.allowedMenus || []))
      .catch(() => setAllowed(null));
  }, [hasToken]);

  useLayoutEffect(() => {
    if (!userOpen || !userRef.current) {
      setUserMenuPos(null);
      return;
    }
    const place = () => {
      const r = userRef.current!.getBoundingClientRect();
      setUserMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [userOpen]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.('.hq-user-menu-portal')) return;
      setUserOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = PARTNER_MENUS.find((m) => (m.end ? loc.pathname === m.to : loc.pathname.startsWith(m.to)));
  const titleKey = current?.key || 'partner.portal';

  useEffect(() => {
    setTabs((prev) => (prev.some((x) => x.to === loc.pathname) ? prev : [...prev, { to: loc.pathname, labelKey: titleKey }]));
  }, [loc.pathname, titleKey]);

  const crumbItems = useMemo(
    () => [
      { key: 'partner.portal', label: t('partner.portal'), to: '/partner' as string | undefined },
      { key: titleKey, label: t(titleKey), to: undefined as string | undefined },
    ],
    [t, titleKey]
  );

  const visible = allowed ? PARTNER_MENUS.filter((m) => allowed.includes(m.menu)) : PARTNER_MENUS;
  if (!hasToken) {
    return <Navigate to="/partner/login" replace />;
  }
  if (otpPending) {
    return <Navigate to="/partner/otp" replace />;
  }
  if (mustChange) {
    return <Navigate to="/partner/password" replace />;
  }
  if (allowed && current && !allowed.includes(current.menu) && visible[0]) {
    return <Navigate to={visible[0].to} replace />;
  }

  const now = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  })();
  const headerLangs = [
    { code: 'ko', label: 'KR' },
    { code: 'ja', label: 'JP' },
    { code: 'en', label: 'EN' },
    { code: 'zh', label: 'CH' },
    { code: 'th', label: 'TH' },
  ] as const;

  const closeTab = (to: string) => {
    setTabs((prev) => {
      const next = prev.filter((x) => x.to !== to);
      if (loc.pathname === to) {
        navigate((next[next.length - 1] ?? { to: '/partner' }).to);
      }
      return next.length ? next : [{ to: '/partner', labelKey: 'partner.navHome' }];
    });
  };

  const closeAllTabs = () => {
    setTabs([{ to: '/partner', labelKey: 'partner.navHome' }]);
    navigate('/partner');
  };

  const logout = () => {
    localStorage.removeItem('partnerToken');
    localStorage.removeItem('partnerMustChangePassword');
    localStorage.removeItem('partnerOtpPending');
    window.location.href = '/partner/login';
  };

  const partnerShellLogo = resolveAdminShellLogo(brand);

  return (
    <ConfirmActionProvider>
    <div className={`hq-shell${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="hq-side">
        <Link to="/partner" className="hq-side-logo">
          {partnerShellLogo ? (
            <img src={partnerShellLogo} alt={brand.productName} />
          ) : (
            <span className="hq-side-logo-text">{brand.productName || 'ICOCARD'}</span>
          )}
        </Link>
        <div className="hq-fold-wrap">
          <button type="button" className="hq-fold" onClick={() => setCollapsed((v) => !v)} title={t('admin.collapse')}>
            {collapsed ? '»' : `« ${t('admin.collapse')}`}
          </button>
        </div>
        <div className="hq-nav">
          {visible.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) => `hq-side-link${isActive ? ' on' : ''}`}
              title={t(m.key)}
            >
              {collapsed ? t(m.key).slice(0, 1) : t(m.key)}
            </NavLink>
          ))}
        </div>
      </aside>
      <div className="hq-main">
        <header className="hq-top">
          <div className="hq-right">
            <div className="hq-langs" aria-label="Language">
              <span className="hq-lang-label">{t('admin.lang')}</span>
              {headerLangs.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={i18n.language.toLowerCase().startsWith(l.code) ? 'on' : ''}
                  onClick={() => void i18n.changeLanguage(l.code as LanguageCode)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <span className="hq-pipe" aria-hidden>
              |
            </span>
            <span className="hq-meta-item">
              {t('admin.sessionIp')}: <b>127.0.0.1</b>
            </span>
            <span className="hq-pipe" aria-hidden>
              |
            </span>
            <span className="hq-meta-item">
              {t('admin.sessionTime')}: <b>{now}</b>
            </span>
            <span className="hq-pipe" aria-hidden>
              |
            </span>
            <div className="hq-user" ref={userRef}>
              <button type="button" className="hq-user-btn" onClick={() => setUserOpen((v) => !v)} aria-expanded={userOpen}>
                <span className="hq-avatar" aria-hidden />
                <span className="hq-user-name">
                  {brand.productName} | {t('partner.portal')}
                </span>
                <span className={`hq-user-caret${userOpen ? ' is-open' : ''}`} />
              </button>
              {userOpen && userMenuPos
                ? createPortal(
                    <div
                      className="hq-user-menu-portal"
                      role="menu"
                      style={{ top: userMenuPos.top, right: userMenuPos.right }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserOpen(false);
                          logout();
                        }}
                      >
                        {t('nav.logout')}
                      </button>
                    </div>,
                    document.body
                  )
                : null}
            </div>
            <button type="button" className="hq-close" onClick={closeAllTabs}>
              <span className="hq-close-x" aria-hidden>
                ✕
              </span>
              <span>{t('admin.closeAll')}</span>
            </button>
          </div>
        </header>
        <div className="hq-content">
          <div className="hq-tabbar">
            {tabs.map((tab) => (
              <span key={tab.to} className={`hq-tab${loc.pathname === tab.to ? ' on' : ''}`}>
                <Link to={tab.to}>{t(tab.labelKey)}</Link>
                <button type="button" className="hq-tab-x" onClick={() => closeTab(tab.to)} aria-label="close">
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="hq-crumbbar">
            <h1 className="hq-crumb-left">{t(titleKey)}</h1>
            <nav className="hq-crumb-right" aria-label="breadcrumb">
              {crumbItems.map((item, i) => (
                <span key={`${item.key}-${i}`} className="hq-crumb-part">
                  {i > 0 ? <span className="hq-crumb-sep">&gt;</span> : null}
                  {item.to && i < crumbItems.length - 1 ? (
                    <Link to={item.to} className="hq-crumb-link">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="hq-crumb-current">{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="hq-page">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
    </ConfirmActionProvider>
  );
}
