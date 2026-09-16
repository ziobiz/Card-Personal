import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, resolveMemberLoginHero } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { useAuth } from '../hooks/useAuth';
import { useTenantNav, TLink } from '../components/TenantLink';
import { authErrorI18nKey } from '../lib/authErrors';
import './Auth.css';

const COUNTRIES = ['KR', 'JP', 'CN', 'HK', 'TW', 'SG', 'TH', 'VN', 'ID', 'MY', 'PH', 'US', 'GB', 'AE'];

function MailIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width={light ? 22 : 18} height={light ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export default function Register() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const { setToken } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [country, setCountry] = useState('KR');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [donePending, setDonePending] = useState(false);
  const navigate = useNavigate();
  const go = useTenantNav();

  useEffect(() => {
    const apiBase =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');
    fetch(apiBase ? `${apiBase}/api/health` : '/api/health')
      .then((r) => r.json())
      .then((d) => setBackendOk(d?.ok === true))
      .catch(() => setBackendOk(false));
    api.auth
      .registrationPolicy()
      .then((p) => setNeedsApproval(p.needsApproval === true))
      .catch(() => setNeedsApproval(false));
  }, []);

  const canSubmit =
    Boolean(email.trim() && password.trim() && passwordConfirm.trim() && agreed) &&
    !loading &&
    backendOk !== false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!agreed) {
      setError(t('auth.termsRequired'));
      return;
    }
    setLoading(true);
    try {
      const r = await api.auth.register(email.trim(), password, {
        displayName: displayName.trim() || undefined,
        country,
      });
      if (r.needsEmailVerify) {
        sessionStorage.setItem('memberEmailVerify', email.trim().toLowerCase());
        navigate(go('/verify-email'));
        return;
      }
      if (r.needsApproval) {
        setDonePending(true);
        return;
      }
      if (r.mustSetupOtp && r.enrollToken) {
        sessionStorage.setItem('memberOtpEnroll', r.enrollToken);
        navigate(go('/otp'));
        return;
      }
      if (r.token) setToken(r.token);
      navigate(go('/'));
    } catch (err) {
      const key = authErrorI18nKey(err);
      setError(key ? t(key) : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="wx-auth"
      style={{ backgroundImage: `url(${resolveMemberLoginHero(brand)})` }}
    >
      <header className="wx-auth-top">
        {brand.logoLogin ? (
          <img src={brand.logoLogin} alt={brand.productName} className="wx-mark-img" />
        ) : (
          <span className="wx-mark">{brand.productName}</span>
        )}
        <LanguageSwitcher />
      </header>
      <div className="wx-auth-body">
        <div className="wx-auth-card">
          <div className="wx-mail-badge">
            <MailIcon light />
          </div>
          {donePending ? (
            <>
              <h1>{t('auth.registerPendingTitle')}</h1>
              <p className="auth-subtitle">{t('auth.registerPendingBody')}</p>
              <TLink to="/login" className="wx-auth-alt">
                {t('auth.goLoginNow')}
              </TLink>
            </>
          ) : (
            <>
              <h1>{t('auth.register')}</h1>
              <p className="auth-subtitle">
                {needsApproval ? t('auth.registerApprovalHint') : t('auth.registerOpenHint')}
              </p>
              <form onSubmit={handleSubmit}>
                {backendOk === false && <div className="auth-error">{t('common.backendUnavailable')}</div>}
                {error && <div className="auth-error">{error}</div>}
                <div className="wx-field">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
                  </svg>
                  <input
                    type="text"
                    placeholder={t('auth.displayNamePlaceholder')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input"
                    autoComplete="name"
                    maxLength={80}
                  />
                </div>
                <div className="wx-field">
                  <MailIcon />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input"
                    autoComplete="email"
                  />
                </div>
                <div className="wx-field">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type="password"
                    placeholder={t('auth.password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input"
                    autoComplete="new-password"
                  />
                </div>
                <div className="wx-field wx-field-submit">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type="password"
                    placeholder={t('auth.passwordConfirm')}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="input"
                    autoComplete="new-password"
                  />
                  <button type="submit" disabled={!canSubmit} className="wx-submit">
                    {loading ? t('auth.registering') : t('auth.submit')}
                  </button>
                </div>
                <div className="wx-field">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a14 14 0 0 1 0 18" />
                  </svg>
                  <select
                    className="input"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    aria-label={t('auth.country')}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="wx-check">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>
                    {t('auth.agreeRegisterPrefix')}{' '}
                    <a href="#terms">{t('auth.terms')}</a> &amp; <a href="#privacy">{t('auth.privacy')}</a>
                  </span>
                </label>
              </form>
              <TLink to="/login" className="wx-auth-alt">
                {t('auth.goLogin')}
              </TLink>
            </>
          )}
        </div>
      </div>
      <p className="wx-copy">{brand.copyright}</p>
    </div>
  );
}
