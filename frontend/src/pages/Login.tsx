import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { useAuth } from '../hooks/useAuth';
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
  const navigate = useNavigate();

  useEffect(() => {
    const apiBase =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');
    fetch(apiBase ? `${apiBase}/api/health` : '/api/health')
      .then((r) => r.json())
      .then((d) => setBackendOk(d?.ok === true))
      .catch(() => setBackendOk(false));
  }, []);

  const canSubmit = Boolean(email.trim() && password.trim()) && !loading && backendOk !== false;

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
    try {
      const r = await api.auth.login(trimmedEmail, trimmedPassword);
      setToken(r.token);
      if (r.otpRequired) {
        navigate('/otp');
        return;
      }
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wx-auth">
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
          </form>
          <Link to="/register" className="wx-auth-alt">
            {t('auth.goRegister')}
          </Link>
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
