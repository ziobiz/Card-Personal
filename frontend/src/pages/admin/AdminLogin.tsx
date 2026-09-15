import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import AdminAuthChrome from '../../components/AdminAuthChrome';

type Step = 'credentials' | 'otp';

export default function AdminLogin() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('credentials');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const otpLock = useRef(false);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRef.current?.focus();
    }
  }, [step]);

  const finishLogin = (token: string) => {
    localStorage.setItem('token', token);
    localStorage.removeItem('adminMustChangePassword');
    sessionStorage.removeItem('adminOtpEnroll');
    navigate('/admin/dashboard');
  };

  const verifyOtp = async (raw: string) => {
    const code = raw.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6 || otpLock.current || loading) return;
    otpLock.current = true;
    setLoading(true);
    setError('');
    try {
      const r = await api.admin.verifyOtp(code);
      finishLogin(r.token);
    } catch (err) {
      setError((err as Error).message || t('auth.otpInvalid'));
      setOtp('');
    } finally {
      setLoading(false);
      otpLock.current = false;
    }
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 'credentials') return;
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
        setOtp('');
        setStep('otp');
        return;
      }
      if (r.token) finishLogin(r.token);
      else navigate('/admin/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (v: string) => {
    const next = v.replace(/\D/g, '').slice(0, 6);
    setOtp(next);
    if (next.length === 6) void verifyOtp(next);
  };

  const canSubmit = Boolean(email.trim() && password.trim()) && !loading && step === 'credentials';

  return (
    <AdminAuthChrome>
      <form onSubmit={handleCredentials}>
        {error ? <div className="ac-error">{error}</div> : null}
        <label className="ac-field">
          {t('auth.email')}
          <input
            type="text"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            readOnly={step === 'otp'}
          />
        </label>
        <label className="ac-field">
          {t('auth.password')}
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            readOnly={step === 'otp'}
          />
        </label>

        {step === 'credentials' ? (
          <button type="submit" className="ac-submit" disabled={!canSubmit}>
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        ) : (
          <label className="ac-field ac-otp-field">
            {t('auth.otpCode')}
            <input
              ref={otpInputRef}
              type="text"
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => onOtpChange(e.target.value)}
              disabled={loading}
              aria-label={t('auth.otpCode')}
            />
            {loading ? <span className="ac-otp-status">{t('auth.otpVerifying')}</span> : null}
          </label>
        )}
      </form>
    </AdminAuthChrome>
  );
}
