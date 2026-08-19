import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useBrand } from '../../brand/BrandContext';
import '../../components/PartnerPortal.css';

export default function PartnerLogin() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await api.partnerPortal.login(email.trim(), password);
      localStorage.setItem('partnerToken', r.token);
      if (r.otpRequired) localStorage.setItem('partnerOtpPending', '1');
      else localStorage.removeItem('partnerOtpPending');
      if (r.mustChangePassword) {
        localStorage.setItem('partnerMustChangePassword', '1');
        navigate('/partner/password');
        return;
      }
      localStorage.removeItem('partnerMustChangePassword');
      if (r.otpRequired) {
        navigate('/partner/otp');
        return;
      }
      navigate('/partner');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tp-login">
      <header className="tp-lang">
        <LanguageSwitcher admin />
      </header>
      <div className="tp-card">
        <div className="tp-alert">
          <strong>{t('partner.scamTitle')}</strong>
          <p>{t('partner.scamBody')}</p>
        </div>
        <h1>{t('auth.login')}</h1>
        {brand.logoAdmin ? <img className="tp-logo" src={brand.logoAdmin} alt={brand.productName} /> : <p className="tp-brand">{brand.productName}</p>}
        {error ? <div className="auth-error">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <label>
            {t('auth.email')}
            <input className="input" type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </label>
          <label>
            {t('auth.password')}
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          <button type="submit" className="btn-primary tp-submit" disabled={loading}>
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>
      </div>
    </div>
  );
}
