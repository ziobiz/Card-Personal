import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, resolveMemberLoginHero } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { TLink } from '../components/TenantLink';
import { authErrorI18nKey } from '../lib/authErrors';
import './Auth.css';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.auth.forgotPassword(email.trim().toLowerCase());
      setStep('reset');
    } catch (err) {
      const key = authErrorI18nKey(err);
      setError(key ? t(key) : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.auth.resetPassword(email.trim().toLowerCase(), code, password);
      setStep('done');
    } catch (err) {
      const key = authErrorI18nKey(err);
      setError(key ? t(key) : (err as Error).message);
    } finally {
      setLoading(false);
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
          {step === 'done' ? (
            <>
              <h1>{t('auth.resetDoneTitle')}</h1>
              <p className="auth-subtitle">{t('auth.resetDoneBody')}</p>
              <TLink to="/login" className="wx-auth-alt">{t('auth.goLoginNow')}</TLink>
            </>
          ) : (
            <>
              <h1>{t('auth.forgotTitle')}</h1>
              <p className="auth-subtitle">
                {step === 'email' ? t('auth.forgotHint') : t('auth.verifyEmailHint', { email })}
              </p>
              {error ? <div className="auth-error">{error}</div> : null}
              {step === 'email' ? (
                <form onSubmit={sendCode}>
                  <div className="wx-field wx-field-submit">
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                    />
                    <button type="submit" className="wx-submit" disabled={loading || !email.trim()}>
                      {loading ? t('common.loading') : t('auth.sendEmailCode')}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={reset}>
                  <div className="wx-field">
                    <input
                      className="input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('auth.emailCodePh')}
                      required
                    />
                  </div>
                  <div className="wx-field">
                    <input
                      className="input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.password')}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="wx-field wx-field-submit">
                    <input
                      className="input"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder={t('auth.passwordConfirm')}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button type="submit" className="wx-submit" disabled={loading || code.length !== 6}>
                      {loading ? t('common.loading') : t('auth.resetPassword')}
                    </button>
                  </div>
                </form>
              )}
              <TLink to="/login" className="wx-auth-alt">{t('auth.goLogin')}</TLink>
            </>
          )}
        </div>
      </div>
      <p className="wx-copy">{brand.copyright}</p>
    </div>
  );
}
