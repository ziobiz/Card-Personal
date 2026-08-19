import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import '../../components/PartnerPortal.css';

export default function PartnerOtp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.partnerPortal.verifyOtp(code.trim());
      localStorage.setItem('partnerToken', r.token);
      localStorage.removeItem('partnerOtpPending');
      if (r.mustChangePassword) {
        localStorage.setItem('partnerMustChangePassword', '1');
        navigate('/partner/password');
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
        <h1>{t('partner.otpTitle')}</h1>
        <p className="muted-text">{t('partner.otpHint')}</p>
        {error ? <div className="auth-error">{error}</div> : null}
        <label>
          OTP
          <input className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button type="submit" className="btn-primary tp-submit" disabled={loading}>
          {t('common.confirm')}
        </button>
      </form>
    </div>
  );
}
