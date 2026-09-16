import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, resolveMemberLoginHero } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import TurnstileWidget from '../components/TurnstileWidget';
import { useBrand } from '../brand/BrandContext';
import { useAuth } from '../hooks/useAuth';
import { useTenantNav, TLink } from '../components/TenantLink';
import { authErrorI18nKey } from '../lib/authErrors';
import './Auth.css';

function MailIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width={light ? 22 : 18} height={light ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const { setToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [tsReset, setTsReset] = useState(0);
  const navigate = useNavigate();
  const go = useTenantNav();
  const needTurnstile = Boolean(brand.turnstileEnabled);

  useEffect(() => {
    const apiBase =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');
    fetch(apiBase ? `${apiBase}/api/health` : '/api/health')
      .then((r) => r.json())
      .then((d) => setBackendOk(d?.ok === true))
      .catch(() => setBackendOk(false));
  }, []);

  const canSubmit =
    Boolean(email.trim() && password.trim()) &&
    !loading &&
    backendOk !== false &&
    (!needTurnstile || Boolean(turnstileToken));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError(t('common.enterEmailPassword'));
      setLoading(false);
      return;
    }
    if (needTurnstile && !turnstileToken) {
      setError(t('auth.turnstileRequired'));
      setLoading(false);
      return;
    }
    try {
      const r = await api.auth.login(trimmedEmail, trimmedPassword, turnstileToken || undefined);
      if (r.mustSetupOtp && r.enrollToken) {
        sessionStorage.setItem('memberOtpEnroll', r.enrollToken);
        sessionStorage.removeItem('memberBiometricAvailable');
        navigate(go('/otp'));
        return;
      }
      if (r.token) setToken(r.token);
      if (r.otpRequired) {
        sessionStorage.removeItem('memberOtpEnroll');
        if (r.biometricAvailable) sessionStorage.setItem('memberBiometricAvailable', '1');
        else sessionStorage.removeItem('memberBiometricAvailable');
        navigate(go('/otp'));
        return;
      }
      navigate(go('/'));
    } catch (err) {
      const key = authErrorI18nKey(err);
      const code = (err as { code?: string }).code;
      if (code === 'email_unverified') {
        sessionStorage.setItem('memberEmailVerify', trimmedEmail);
        navigate(go('/verify-email'));
        return;
      }
      setError(key ? t(key) : (err as Error).message);
      setTurnstileToken('');
      setTsReset((n) => n + 1);
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
          <h1>{t('auth.login')}</h1>
          <p className="auth-subtitle">{t('auth.loginHint')}</p>
          <form onSubmit={handleSubmit}>
            {backendOk === false && <div className="auth-error">{t('common.backendUnavailable')}</div>}
            {error && <div className="auth-error">{error}</div>}
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
            <div className="wx-field wx-field-submit">
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
                className="input"
                autoComplete="current-password"
              />
              <button type="submit" disabled={!canSubmit} className="wx-submit">
                {loading ? t('auth.loggingIn') : t('auth.submit')}
              </button>
            </div>
            <TurnstileWidget onToken={setTurnstileToken} resetKey={tsReset} theme="dark" />
          </form>
          <TLink to="/forgot-password" className="wx-auth-alt">
            {t('auth.forgotPassword')}
          </TLink>
          <TLink to="/register" className="wx-auth-alt">
            {t('auth.goRegister')}
          </TLink>
          <p className="wx-legal">
            {t('auth.agreePrefix')}{' '}
            <a href="#terms">{t('auth.terms')}</a> &amp; <a href="#privacy">{t('auth.privacy')}</a>
          </p>
          <a href="/admin/login" className="wx-admin-link">
            {t('auth.adminLink')}
          </a>
        </div>
      </div>
      <p className="wx-copy">{brand.copyright}</p>
    </div>
  );
}
