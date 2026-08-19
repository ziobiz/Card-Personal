import { Link, NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { type LanguageCode } from '../i18n';
import { useBrand } from '../brand/BrandContext';
import './AdminLayout.css';

type MenuItem = { to: string; labelKey: string };
type IconName = 'gear' | 'cloud' | 'phone' | 'card' | 'user' | 'ops';
type MenuGroup = { id: string; labelKey: string; icon: IconName; items: MenuItem[] };
type OpenTab = { to: string; labelKey: string };

function SideIcon({ name }: { name: IconName }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'gear') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    );
  }
  if (name === 'cloud') {
    return (
      <svg {...common}>
        <path d="M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.4A3.5 3.5 0 0 0 7 18Z" />
        <path d="M12 11v6M9.5 14.5 12 12l2.5 2.5" />
      </svg>
    );
  }
  if (name === 'phone') {
    return (
      <svg {...common}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  }
  if (name === 'card') {
    return (
      <svg {...common}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    );
  }
  if (name === 'user') {
    return (
      <svg {...common}>
        <circle cx="10" cy="8" r="3.2" />
        <path d="M4 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5" />
        <circle cx="17.5" cy="16.5" r="3" />
        <path d="M17.5 15.2v2.6M16.2 16.5h2.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function tokenEmail() {
  try {
    const token = localStorage.getItem('token') || '';
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return String(payload.email || '');
  } catch {
    return '';
  }
}

export default function AdminLayout() {
  const { t, i18n } = useTranslation();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const loc = useLocation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tablet, setTablet] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [flyId, setFlyId] = useState<string | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([
    { to: '/admin/dashboard', labelKey: 'admin.navDashboard' },
    { to: '/admin/fee-list', labelKey: 'admin.navFeeList' },
    { to: '/admin/fee-policy', labelKey: 'admin.navFeePolicy' },
    { to: '/admin/partners', labelKey: 'admin.navPartners' },
  ]);

  const groups: MenuGroup[] = [
    {
      id: 'hq',
      labelKey: 'admin.menuHq',
      icon: 'gear',
      items: [
        { to: '/admin/brand', labelKey: 'admin.navBrand' },
        { to: '/admin/settings', labelKey: 'admin.navSettings' },
      ],
    },
    {
      id: 'merchant',
      labelKey: 'admin.menuMerchant',
      icon: 'phone',
      items: [
        { to: '/admin/partners', labelKey: 'admin.navPartners' },
        { to: '/admin/partners/new', labelKey: 'admin.navPartnerReg' },
        { to: '/admin/org', labelKey: 'admin.navOrg' },
        { to: '/admin/fee-list', labelKey: 'admin.navFeeList' },
        { to: '/admin/fee-policy', labelKey: 'admin.navFeePolicy' },
      ],
    },
    {
      id: 'users',
      labelKey: 'admin.menuUsers',
      icon: 'user',
      items: [
        { to: '/admin/operators', labelKey: 'admin.navHqOperators' },
        { to: '/admin/operators/partner', labelKey: 'admin.navPartnerOperators' },
      ],
    },
    {
      id: 'members',
      labelKey: 'admin.menuMembers',
      icon: 'card',
      items: [
        { to: '/admin/members', labelKey: 'admin.navDirectMembers' },
        { to: '/admin/members/partner', labelKey: 'admin.navPartnerMembers' },
      ],
    },
    {
      id: 'ops',
      labelKey: 'admin.menuOps',
      icon: 'ops',
      items: [
        { to: '/admin/dashboard', labelKey: 'admin.navDashboard' },
        { to: '/admin/cards', labelKey: 'admin.navCards' },
      ],
    },
  ];

  const crumb = useMemo(() => {
    const map: Record<string, string[]> = {
      '/admin/dashboard': ['admin.menuMain', 'admin.navDashboard'],
      '/admin/partners': ['admin.menuMerchant', 'admin.navPartners'],
      '/admin/partners/new': ['admin.menuMerchant', 'admin.navPartnerReg'],
      '/admin/org': ['admin.menuMerchant', 'admin.navOrg'],
      '/admin/fee-list': ['admin.menuMerchant', 'admin.navFeeList'],
      '/admin/fee-policy': ['admin.menuMerchant', 'admin.navFeePolicy'],
      '/admin/settings': ['admin.menuHq', 'admin.navSettings'],
      '/admin/brand': ['admin.menuHq', 'admin.navBrand'],
      '/admin/operators': ['admin.menuUsers', 'admin.navHqOperators'],
      '/admin/operators/partner': ['admin.menuUsers', 'admin.navPartnerOperators'],
      '/admin/members': ['admin.menuMembers', 'admin.navDirectMembers'],
      '/admin/members/partner': ['admin.menuMembers', 'admin.navPartnerMembers'],
      '/admin/users': ['admin.menuUsers', 'admin.navHqOperators'],
      '/admin/cards': ['admin.menuOps', 'admin.navCards'],
      '/admin/me': ['admin.myInfo'],
    };
    return map[loc.pathname] ?? ['admin.menuMain'];
  }, [loc.pathname]);

  const title = t(crumb[crumb.length - 1] || 'admin.brand');
  const now = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  })();
  const headerLangs = [
    { code: 'ja', label: 'JP' },
    { code: 'ko', label: 'KR' },
    { code: 'en', label: 'EN' },
    { code: 'zh', label: 'CH' },
    { code: 'th', label: 'TH' },
  ] as const;

  useEffect(() => {
    const labelKey = crumb[crumb.length - 1] || 'admin.navDashboard';
    setTabs((prev) => (prev.some((x) => x.to === loc.pathname) ? prev : [...prev, { to: loc.pathname, labelKey }]));
  }, [loc.pathname, crumb]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const closeTab = (to: string) => {
    setTabs((prev) => {
      const next = prev.filter((x) => x.to !== to);
      if (loc.pathname === to) {
        navigate((next[next.length - 1] ?? { to: '/admin/dashboard' }).to);
      }
      return next.length ? next : [{ to: '/admin/dashboard', labelKey: 'admin.navDashboard' }];
    });
  };

  const closeAllTabs = () => {
    setTabs([{ to: '/admin/dashboard', labelKey: 'admin.navDashboard' }]);
    navigate('/admin/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/admin/login');
  };

  const theme = {
    '--hq-side': brand.sidebarBg || '#2c3138',
    '--hq-accent': brand.accentColor || '#6658dd',
    '--hq-logo-bg': brand.logoBg || '#2c3138',
  } as CSSProperties;

  const currentId = groups.find((x) => x.items.some((it) => loc.pathname === it.to))?.id;

  return (
    <div className={`hq-shell${collapsed ? ' is-collapsed' : ''}${tablet ? ' is-tablet' : ''}`} style={theme}>
      <div className="hq-body">
        <aside className="hq-side">
          <Link to="/admin/dashboard" className="hq-side-logo">
            {brand.logoAdmin ? <img src={brand.logoAdmin} alt={brand.productName} /> : <span className="hq-side-logo-text">{brand.productName || 'on the line'}</span>}
          </Link>
          <div className="hq-fold-wrap">
            <button type="button" className="hq-fold" onClick={() => setCollapsed((v) => !v)} title={t('admin.collapse')}>
              {collapsed ? '»' : `« « ${t('admin.collapse')}`}
            </button>
          </div>
          <div className="hq-nav">
          {groups.map((g) => {
            const inSection = g.items.some((it) => loc.pathname === it.to);
            const expanded = collapsed ? false : (openId ?? currentId) === g.id;
            return (
              <div
                key={g.id}
                className={`hq-group${expanded ? ' is-open' : ''}${inSection ? ' is-current' : ''}`}
                onMouseEnter={() => collapsed && setFlyId(g.id)}
                onMouseLeave={() => collapsed && setFlyId((id) => (id === g.id ? null : id))}
              >
                <button
                  type="button"
                  className={`hq-group-title${expanded ? ' is-open' : ''}${inSection ? ' is-active' : ''}`}
                  onClick={() => {
                    if (collapsed) {
                      setFlyId((id) => (id === g.id ? null : g.id));
                      return;
                    }
                    setOpenId(expanded ? '' : g.id);
                  }}
                  title={t(g.labelKey)}
                >
                  <span className="hq-ico">
                    <SideIcon name={g.icon} />
                  </span>
                  <span className="hq-group-label">{t(g.labelKey)}</span>
                  <span className={`hq-caret${expanded ? ' is-open' : ''}`} aria-hidden>
                    &gt;
                  </span>
                </button>
                {expanded && (
                  <div className="hq-sub">
                    {g.items.map((it) => (
                      <NavLink key={it.to} to={it.to} end className={({ isActive }) => (isActive ? 'on' : '')}>
                        {t(it.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                )}
                {collapsed && flyId === g.id && (
                  <div className="hq-flyout">
                    <div className="hq-flyout-title">{t(g.labelKey)}</div>
                    {g.items.map((it) => (
                      <NavLink key={it.to} to={it.to} end className={({ isActive }) => (isActive ? 'on' : '')} onClick={() => setFlyId(null)}>
                        {t(it.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </aside>
        <div className="hq-content">
          <header className="hq-top">
            <div className="hq-top-fill" />
            <div className="hq-right">
              <label className="hq-tablet">
                <span>{t('admin.tablet')}</span>
                <input type="checkbox" checked={tablet} onChange={(e) => setTablet(e.target.checked)} />
              </label>
              <div className="hq-langs" aria-label="Language">
                <span className="hq-lang-label">{t('admin.lang')}</span>
                {headerLangs.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className={i18n.language.toLowerCase().startsWith(l.code) ? 'on' : ''}
                    onClick={() => i18n.changeLanguage(l.code as LanguageCode)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <span className="hq-meta-item">
                {t('admin.sessionIp')}: <b>127.0.0.1</b>
              </span>
              <span className="hq-meta-item">
                {t('admin.sessionTime')}: <b>{now}</b>
              </span>
              <div className="hq-user" ref={userRef}>
                <button type="button" className="hq-user-btn" onClick={() => setUserOpen((v) => !v)}>
                  <span className="hq-avatar" aria-hidden />
                  <span className="hq-user-name">
                    {brand.operatorName} HQ | {t('admin.roleAdmin')}
                  </span>
                  <span className={`hq-user-caret${userOpen ? ' is-open' : ''}`} />
                </button>
                {userOpen && (
                  <div className="hq-user-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setUserOpen(false);
                        navigate('/admin/me');
                      }}
                    >
                      {t('admin.myInfo')}
                    </button>
                    <button type="button" onClick={logout}>
                      {t('admin.logout')}
                    </button>
                  </div>
                )}
              </div>
              <button type="button" className="hq-close" onClick={closeAllTabs}>
                ✕ {t('admin.closeAll')}
              </button>
            </div>
          </header>
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
            <span className="hq-crumb-left">&gt; {title}</span>
            <span className="hq-crumb-right">
              {crumb.map((k, i) => (
                <span key={`${k}-${i}`}>
                  {i > 0 ? <span className="hq-crumb-sep">&gt;</span> : null}
                  {t(k)}
                </span>
              ))}
            </span>
          </div>
          <div className="hq-page">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export { tokenEmail };
