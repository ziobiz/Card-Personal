import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useBrand } from '../../brand/BrandContext';
import '../../pages/Auth.css';

function MailIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width={light ? 22 : 18} height={light ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export default function AdminLogin() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await api.admin.login(email.trim(), password);
      if (r.mustChangePassword && r.token) {
        localStorage.setItem('token', r.token);
        localStorage.setItem('adminMustChangePassword', '1');
        navigate('/admin/password');
        return;
      }
      if (r.mustSetupOtp && r.enrollToken) {
        sessionStorage.setItem('adminOtpEnroll', r.enrollToken);
        navigate('/admin/otp');
        return;
      }
      if (r.token) localStorage.setItem('token', r.token);
      if (r.otpRequired) {
        sessionStorage.removeItem('adminOtpEnroll');
        navigate('/admin/otp');
        return;
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = Boolean(email.trim() && password.trim()) && !loading;

  return (
    <div className="wx-auth admin-wx-auth">
      <header className="wx-auth-top">
        {brand.logoAdmin || brand.logoLogin ? (
          <img src={brand.logoAdmin || brand.logoLogin} alt={brand.productName} className="wx-mark-img" />
        ) : (
          <span className="wx-mark">{brand.productName}</span>
        )}
        <LanguageSwitcher admin />
      </header>
      <div className="wx-auth-body">
        <div className="wx-auth-card">
          <div className="wx-mail-badge">
            <MailIcon light />
          </div>
          <h1>{t('admin.loginTitle')}</h1>
          <p className="auth-subtitle">{t('admin.loginSubtitle')}</p>
          <form onSubmit={handleSubmit}>
            {error ? <div className="auth-error">{error}</div> : null}
            <div className="wx-field">
              <MailIcon />
              <input
                type="text"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                autoComplete="username"
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
                {loading ? t('auth.loggingIn') : t('auth.loginButton')}
              </button>
            </div>
          </form>
          <a href="/login" className="wx-auth-alt">
            {t('admin.userLogin')}
          </a>
        </div>
      </div>
      <p className="wx-copy">{brand.copyright}</p>
    </div>
  );
}
