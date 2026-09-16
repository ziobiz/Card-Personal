import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, resolveMemberLoginHero } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { useAuth } from '../hooks/useAuth';
import { useTenantNav, TLink } from '../components/TenantLink';
import { authErrorI18nKey } from '../lib/authErrors';
import './Auth.css';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const { setToken } = useAuth();
  const navigate = useNavigate();
  const go = useTenantNav();
  const [email] = useState(() => (sessionStorage.getItem('memberEmailVerify') || '').toLowerCase());
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!email) navigate(go('/register'), { replace: true });
  }, [email, go, navigate]);

  const afterOk = (r: {
    needsApproval?: boolean;
    mustSetupOtp?: boolean;
    enrollToken?: string;
    token?: string;
  }) => {
    sessionStorage.removeItem('memberEmailVerify');
    if (r.needsApproval) {
      setPending(true);
      return;
    }
    if (r.mustSetupOtp && r.enrollToken) {
      sessionStorage.setItem('memberOtpEnroll', r.enrollToken);
      navigate(go('/otp'));
      return;
    }
    if (r.token) setToken(r.token);
    navigate(go('/'));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await api.auth.verifyEmail(email, code);
      afterOk(r);
    } catch (err) {
      const key = authErrorI18nKey(err);
      setError(key ? t(key) : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      await api.auth.resendEmailCode(email, 'register');
      setInfo(t('auth.emailCodeSent'));
    } catch (err) {
      const key = authErrorI18nKey(err);
      setError(key ? t(key) : (err as Error).message);
    }
  };

  return (
    <div className="wx-auth" style={{ backgroundImage: `url(${resolveMemberLoginHero(brand)})` }}>
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
          {pending ? (
            <>
              <h1>{t('auth.registerPendingTitle')}</h1>
              <p className="auth-subtitle">{t('auth.registerPendingBody')}</p>
              <TLink to="/login" className="wx-auth-alt">{t('auth.goLoginNow')}</TLink>
            </>
          ) : (
            <>
              <h1>{t('auth.verifyEmailTitle')}</h1>
              <p className="auth-subtitle">{t('auth.verifyEmailHint', { email })}</p>
              <form onSubmit={submit}>
                {error ? <div className="auth-error">{error}</div> : null}
                {info ? <p className="auth-subtitle">{info}</p> : null}
                <div className="wx-field wx-field-submit">
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('auth.emailCodePh')}
                    required
                  />
                  <button type="submit" className="wx-submit" disabled={loading || code.length !== 6}>
                    {loading ? t('auth.otpVerifying') : t('auth.otpVerify')}
                  </button>
                </div>
              </form>
              <button type="button" className="wx-auth-alt" onClick={resend}>
                {t('auth.resendEmailCode')}
              </button>
              <TLink to="/login" className="wx-auth-alt">{t('auth.goLogin')}</TLink>
            </>
          )}
        </div>
      </div>
      <p className="wx-copy">{brand.copyright}</p>
    </div>
  );
}
