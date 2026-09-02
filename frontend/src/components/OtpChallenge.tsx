import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import '../pages/Auth.css';

type SetupResult = { secret: string; otpauthUrl: string };
type VerifyResult = { token: string; offerBiometric?: boolean };

type Props = {
  admin?: boolean;
  mode: 'verify' | 'setup';
  enrollToken?: string | null;
  onSetup: (enrollToken: string) => Promise<SetupResult>;
  onActivate: (enrollToken: string, code: string) => Promise<VerifyResult>;
  onVerify: (code: string) => Promise<VerifyResult>;
  onSuccess: (token: string, meta?: { offerBiometric?: boolean }) => void;
  backHref: string;
};

function ShieldIcon({ light = false }: { light?: boolean }) {
  return (
    <svg width={light ? 22 : 18} height={light ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function OtpChallenge({
  admin = false,
  mode,
  enrollToken,
  onSetup,
  onActivate,
  onVerify,
  onSuccess,
  backHref,
}: Props) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [ready, setReady] = useState(mode === 'verify');

  useEffect(() => {
    if (mode !== 'setup' || !enrollToken) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await onSetup(enrollToken);
        if (cancelled) return;
        setSecret(r.secret);
        setOtpauthUrl(r.otpauthUrl);
        setReady(true);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // setup once per enroll token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, enrollToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const trimmed = code.replace(/\D/g, '');
      const r =
        mode === 'setup'
          ? await onActivate(String(enrollToken || ''), trimmed)
          : await onVerify(trimmed);
      onSuccess(r.token, { offerBiometric: r.offerBiometric });
    } catch (err) {
      setError((err as Error).message || t('auth.otpInvalid'));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = code.replace(/\D/g, '').length === 6 && !loading && ready;

  return (
    <div className={`wx-auth ${admin ? 'admin-wx-auth' : ''}`}>
      <header className="wx-auth-top">
        {brand.logoAdmin || brand.logoLogin ? (
          <img src={brand.logoAdmin || brand.logoLogin} alt={brand.productName} className="wx-mark-img" />
        ) : (
          <span className="wx-mark">{brand.productName}</span>
        )}
        <LanguageSwitcher admin={admin} />
      </header>
      <div className="wx-auth-body">
        <div className="wx-auth-card">
          <div className="wx-mail-badge">
            <ShieldIcon light />
          </div>
          <h1>{mode === 'setup' ? t('auth.otpGoogleTitle') : t('auth.otpTitle')}</h1>
          <p className="auth-subtitle">
            {mode === 'setup' ? t('auth.otpScanHint') : t('auth.otpTotpHint')}
          </p>
          {mode === 'setup' && otpauthUrl ? (
            <div style={{ marginBottom: 16 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`}
                alt="OTP QR"
                width={180}
                height={180}
                style={{ borderRadius: 12, background: '#fff', padding: 8 }}
              />
              <p className="muted-text" style={{ marginTop: 10, fontSize: 12, wordBreak: 'break-all' }}>
                {t('auth.otpSecret')}: <code>{secret}</code>
              </p>
            </div>
          ) : null}
          <form onSubmit={handleSubmit}>
            {error ? <div className="auth-error">{error}</div> : null}
            <div className="wx-field wx-field-submit">
              <ShieldIcon />
              <input
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t('auth.otpCode')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
              />
              <button type="submit" disabled={!canSubmit} className="wx-submit">
                {loading ? t('auth.otpVerifying') : t('auth.otpVerify')}
              </button>
            </div>
          </form>
          <a href={backHref} className="wx-auth-alt">
            {t('auth.otpBack')}
          </a>
        </div>
      </div>
      <p className="wx-copy">{brand.copyright}</p>
    </div>
  );
}
