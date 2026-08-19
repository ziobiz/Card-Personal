import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import '../../components/PartnerPortal.css';

export default function PartnerPassword() {
  const { t } = useTranslation();
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
      await api.partnerPortal.changePassword(password);
      localStorage.removeItem('partnerMustChangePassword');
      if (localStorage.getItem('partnerOtpPending')) {
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
      <form className="tp-card" onSubmit={handleSubmit}>
        <h1>{t('partner.setPassword')}</h1>
        <p className="muted-text">{t('partner.setPasswordHint')}</p>
        {error ? <div className="auth-error">{error}</div> : null}
        <label>
          {t('auth.password')}
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          {t('admin.passwordConfirm')}
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        <button type="submit" className="btn-primary tp-submit" disabled={loading}>
          {t('common.confirm')}
        </button>
      </form>
    </div>
  );
}
