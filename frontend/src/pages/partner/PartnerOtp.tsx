import { useEffect, useState } from 'react';
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
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const mustSetup = localStorage.getItem('partnerOtpSetup') === '1';

  useEffect(() => {
    if (!mustSetup) return;
    api.partnerPortal
      .otpSetup()
      .then((r) => {
        setSecret(r.secret);
        setOtpauthUrl(r.otpauthUrl);
      })
      .catch((err) => setError((err as Error).message));
  }, [mustSetup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.partnerPortal.verifyOtp(code.trim());
      localStorage.setItem('partnerToken', r.token);
      localStorage.removeItem('partnerOtpPending');
      localStorage.removeItem('partnerOtpSetup');
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
        <h1>{mustSetup ? t('auth.otpGoogleTitle') : t('partner.otpTitle')}</h1>
        <p className="muted-text">{mustSetup ? t('auth.otpScanHint') : t('partner.otpHint')}</p>
        {mustSetup && otpauthUrl ? (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(otpauthUrl)}`}
              alt="OTP QR"
              width={160}
              height={160}
            />
            <p className="muted-text" style={{ fontSize: 12, wordBreak: 'break-all' }}>
              {t('auth.otpSecret')}: <code>{secret}</code>
            </p>
          </div>
        ) : null}
        {error ? <div className="auth-error">{error}</div> : null}
        <label>
          {t('auth.otpCode')}
          <input className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button type="submit" className="btn-primary tp-submit" disabled={loading}>
          {loading ? t('auth.otpVerifying') : t('auth.otpVerify')}
        </button>
      </form>
    </div>
  );
}
