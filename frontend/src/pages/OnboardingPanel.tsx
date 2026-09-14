import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

type Onboard = {
  status: string;
  error: string | null;
  eoa: string;
  smartWallet: string;
  wirexUserId?: string | null;
  kycStatus?: string;
  mock?: boolean;
};

const STEPS = ['wallet', 'onchain', 'registered', 'kyc', 'ready'] as const;

function stepIndex(status: string) {
  if (status === 'ready') return 4;
  if (status === 'kyc') return 3;
  if (status === 'registered') return 2;
  if (status === 'onchain') return 1;
  if (status === 'wallet') return 0;
  return -1;
}

export default function OnboardingPanel() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<Onboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [kycBusy, setKycBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      setInfo(await api.user.onboarding());
    } catch {
      setInfo(null);
    }
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, []);

  if (!info || info.mock || info.status === 'ready') return null;

  const idx = stepIndex(info.status);

  const run = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await api.user.onboard({ issueCard: true });
      setInfo({
        status: r.onboarding.status,
        error: r.onboarding.error,
        eoa: r.onboarding.eoa,
        smartWallet: r.onboarding.smartWallet,
      });
      if (r.kycUrl) window.open(r.kycUrl, '_blank');
      if (!r.ok) setMsg(r.onboarding.error || t('onboard.failed'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      void load();
    }
  };

  const openKyc = async () => {
    setKycBusy(true);
    try {
      const { url } = await api.kyc.getVerificationLink();
      if (url) window.location.href = url;
    } finally {
      setKycBusy(false);
    }
  };

  return (
    <section className="card-surface wx-onboard">
      <h3 className="section-title">{t('onboard.title')}</h3>
      <p className="muted-text wx-onboard-lead">{t('onboard.lead')}</p>
      <ol className="wx-onboard-steps">
        {STEPS.map((key, i) => (
          <li key={key} className={i <= idx ? 'done' : info.status === 'error' && i === idx + 1 ? 'bad' : ''}>
            <span className="wx-onboard-n">{i + 1}</span>
            <span>{t(`onboard.step.${key}`)}</span>
          </li>
        ))}
      </ol>
      {info.eoa ? (
        <p className="wx-onboard-addr">
          EOA <code>{info.eoa}</code>
        </p>
      ) : null}
      {info.smartWallet ? (
        <p className="wx-onboard-addr">
          Smart Wallet <code>{info.smartWallet}</code>
        </p>
      ) : null}
      {info.error ? <p className="auth-error">{info.error}</p> : null}
      {msg ? <p className="auth-error">{msg}</p> : null}
      <div className="wx-onboard-actions">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void run()}>
          {busy ? t('onboard.running') : t('onboard.continue')}
        </button>
        {(info.status === 'registered' || info.status === 'kyc') && (
          <button type="button" className="wx-ghost" disabled={kycBusy} onClick={() => void openKyc()}>
            {t('dashboard.kycCta')}
          </button>
        )}
        {info.status === 'kyc' || info.status === 'registered' ? (
          <Link to="/cards/issue" className="wx-ghost">
            {t('nav.cardsIssue')}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
