import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import OtpChallenge from '../components/OtpChallenge';
import { FingerprintIcon } from '../components/BrandIcons';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import { useAuth } from '../hooks/useAuth';
import './Auth.css';

function isMobileClient() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const narrow = window.matchMedia?.('(max-width: 900px)').matches;
  return mobileUa || (Boolean(coarse) && Boolean(narrow));
}

async function platformBiometricAvailable() {
  try {
    if (!window.PublicKeyCredential) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export default function MemberOtp() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const enrollToken = useMemo(() => sessionStorage.getItem('memberOtpEnroll') || '', []);
  const mode = enrollToken ? 'setup' : 'verify';
  const biometricAvailable = sessionStorage.getItem('memberBiometricAvailable') === '1';
  const [mobile, setMobile] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [method, setMethod] = useState<'choose' | 'otp' | 'bio'>('otp');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [offerEnroll, setOfferEnroll] = useState(false);
  const [pendingToken, setPendingToken] = useState('');

  useEffect(() => {
    const m = isMobileClient();
    setMobile(m);
    platformBiometricAvailable().then((ok) => {
      setBioOk(ok);
      if (mode === 'verify' && m && ok && biometricAvailable) setMethod('choose');
      else setMethod('otp');
    });
  }, [mode, biometricAvailable]);

  const finish = (token: string, offerBiometric?: boolean) => {
    setToken(token);
    sessionStorage.removeItem('memberOtpEnroll');
    sessionStorage.removeItem('memberBiometricAvailable');
    if (mobile && bioOk && offerBiometric) {
      setPendingToken(token);
      setOfferEnroll(true);
      return;
    }
    navigate('/');
  };

  const runBiometricLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const options = await api.auth.webauthnLoginOptions();
      const assertion = await startAuthentication({ optionsJSON: options as never });
      const r = await api.auth.webauthnLoginVerify(assertion);
      finish(r.token, false);
    } catch (err) {
      setError((err as Error).message || t('auth.biometricFailed'));
      setMethod('otp');
    } finally {
      setLoading(false);
    }
  };

  const enrollBiometric = async () => {
    setLoading(true);
    setError('');
    try {
      if (pendingToken) localStorage.setItem('token', pendingToken);
      const options = await api.auth.webauthnRegisterOptions();
      const att = await startRegistration({ optionsJSON: options as never });
      await api.auth.webauthnRegisterVerify(att);
      navigate('/');
    } catch (err) {
      setError((err as Error).message || t('auth.biometricEnrollFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (offerEnroll) {
    return (
      <div className="wx-auth">
        <header className="wx-auth-top">
          <span className="wx-mark">{brand.productName}</span>
          <LanguageSwitcher />
        </header>
        <div className="wx-auth-body">
          <div className="wx-auth-card">
            <div className="wx-mail-badge">
              <FingerprintIcon size={24} />
            </div>
            <h1>{t('auth.biometricEnrollTitle')}</h1>
            <p className="auth-subtitle">{t('auth.biometricEnrollHint')}</p>
            {error ? <div className="auth-error">{error}</div> : null}
            <button type="button" className="btn-primary" disabled={loading} onClick={enrollBiometric} style={{ marginTop: 8 }}>
              {loading ? t('auth.otpVerifying') : t('auth.biometricEnrollBtn')}
            </button>
            <button
              type="button"
              className="wx-auth-alt"
              onClick={() => navigate('/')}
              style={{ marginTop: 16, background: 'none', border: 'none', width: '100%' }}
            >
              {t('auth.biometricSkip')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (method === 'choose') {
    return (
      <div className="wx-auth">
        <header className="wx-auth-top">
          <span className="wx-mark">{brand.productName}</span>
          <LanguageSwitcher />
        </header>
        <div className="wx-auth-body">
          <div className="wx-auth-card">
            <div className="wx-mail-badge">
              <FingerprintIcon size={24} />
            </div>
            <h1>{t('auth.secondFactorTitle')}</h1>
            <p className="auth-subtitle">{t('auth.secondFactorHint')}</p>
            {error ? <div className="auth-error">{error}</div> : null}
            <button type="button" className="btn-primary" disabled={loading} onClick={runBiometricLogin}>
              {loading ? t('auth.otpVerifying') : t('auth.biometricBtn')}
            </button>
            <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setMethod('otp')}>
              {t('auth.useOtpInstead')}
            </button>
          </div>
        </div>
        <p className="wx-copy">{brand.copyright}</p>
      </div>
    );
  }

  return (
    <OtpChallenge
      mode={mode}
      enrollToken={enrollToken}
      backHref="/login"
      onSetup={(token) => api.auth.setupOtp(token)}
      onActivate={async (token, code) => {
        const r = await api.auth.activateOtp(token, code);
        sessionStorage.removeItem('memberOtpEnroll');
        return r;
      }}
      onVerify={(code) => api.auth.verifyOtp(code)}
      onSuccess={(token, meta) => {
        finish(token, Boolean(meta?.offerBiometric) && mobile && bioOk);
      }}
    />
  );
}
