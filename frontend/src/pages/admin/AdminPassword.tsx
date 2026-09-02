import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useBrand } from '../../brand/BrandContext';
import '../../pages/Auth.css';

function LockIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width={light ? 22 : 18} height={light ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function AdminPassword() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError(t('admin.passwordMin'));
      return;
    }
    if (password !== confirm) {
      setError(t('admin.passwordMismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await api.admin.changePassword(password);
      localStorage.removeItem('adminMustChangePassword');
      if (r.mustSetupOtp && r.enrollToken) {
        sessionStorage.setItem('adminOtpEnroll', r.enrollToken);
        navigate('/admin/otp');
        return;
      }
      if (r.otpRequired && r.token) {
        localStorage.setItem('token', r.token);
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

  const canSubmit = Boolean(password.trim() && confirm.trim()) && !loading;

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
            <LockIcon light />
          </div>
          <h1>{t('partner.setPassword')}</h1>
          <p className="auth-subtitle">{t('partner.setPasswordHint')}</p>
          <form onSubmit={handleSubmit}>
            {error ? <div className="auth-error">{error}</div> : null}
            <div className="wx-field">
              <LockIcon />
              <input
                className="input"
                type="password"
                placeholder={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="wx-field wx-field-submit">
              <LockIcon />
              <input
                className="input"
                type="password"
                placeholder={t('admin.passwordConfirm')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="submit" disabled={!canSubmit} className="wx-submit">
                {loading ? t('admin.saving') : t('common.confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
      <p className="wx-copy">{brand.copyright}</p>
    </div>
  );
}
