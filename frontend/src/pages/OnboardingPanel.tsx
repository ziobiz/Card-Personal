import { useEffect, useState } from 'react';
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
  busy?: boolean;
};

const WALLET_STEPS = ['wallet', 'onchain', 'registered'] as const;

function walletStepIndex(status: string) {
  if (status === 'ready' || status === 'kyc' || status === 'registered') return 2;
  if (status === 'onchain') return 1;
  if (status === 'wallet') return 0;
  return -1;
}

function openExternal(url: string) {
  window.location.assign(url);
}

export default function OnboardingPanel({ variant }: { variant: 'wallet' | 'kyc' }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<Onboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [kycBusy, setKycBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');

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

  if (!info || info.mock) return null;

  const kycDone = info.kycStatus === 'verified' || info.status === 'ready';
  const walletIssued = Boolean(info.eoa || info.smartWallet);
  const walletSetupDone = walletIssued && ['registered', 'kyc', 'ready'].includes(info.status);
  const needsWalletSetup = variant === 'wallet' && !walletSetupDone;
  const needsKyc = variant === 'kyc' && walletIssued && !kycDone;

  if (variant === 'wallet' && !needsWalletSetup) return null;
  if (variant === 'kyc' && !needsKyc) return null;

  const idx = walletStepIndex(info.status);

  const openKyc = async () => {
    setKycBusy(true);
    setMsg('');
    setOkMsg('');
    try {
      const r = await api.kyc.getVerificationLink();
      if (r.url) {
        setOkMsg(t('onboard.kycOpening'));
        openExternal(r.url);
        return;
      }
      setMsg(r.message || t('onboard.kycNoLink'));
    } catch (e) {
      setMsg((e as Error).message || t('onboard.kycNoLink'));
    } finally {
      setKycBusy(false);
    }
  };

  const runWallet = async () => {
    setBusy(true);
    setMsg('');
    setOkMsg('');
    try {
      const r = await api.user.onboard({ issueCard: false });
      setInfo({
        status: r.onboarding.status,
        error: r.onboarding.error,
        eoa: r.onboarding.eoa,
        smartWallet: r.onboarding.smartWallet,
        kycStatus: r.onboarding.kycStatus || info.kycStatus,
        wirexUserId: r.onboarding.wirexUserId,
        mock: info.mock,
        busy: false,
      });
      if (!r.ok) setMsg(r.kycError || r.onboarding.error || t('onboard.failed'));
      else setOkMsg(t('onboard.progressOk'));
    } catch (e) {
      const text = (e as Error).message || '';
      setMsg(/already in progress/i.test(text) ? t('onboard.inProgress') : text);
    } finally {
      setBusy(false);
      void load();
    }
  };

  if (variant === 'kyc') {
    return (
      <section className="card-surface wx-onboard">
        <h3 className="section-title">{t('onboard.kycTitle')}</h3>
        <p className="muted-text wx-onboard-lead">{t('onboard.kycLead')}</p>
        {info.error ? <p className="auth-error">{info.error}</p> : null}
        {msg ? <p className="auth-error">{msg}</p> : null}
        {okMsg ? <p className="wx-account-ok">{okMsg}</p> : null}
        <div className="wx-onboard-actions">
          <button type="button" className="btn-primary" disabled={kycBusy} onClick={() => void openKyc()}>
            {kycBusy ? t('common.loading') : t('dashboard.kycCta')}
          </button>
        </div>
      </section>
    );
  }

  const waiting = busy || Boolean(info.busy);

  return (
    <section className="card-surface wx-onboard">
      <h3 className="section-title">{t('onboard.walletTitle')}</h3>
      <p className="muted-text wx-onboard-lead">{t('onboard.walletLead')}</p>
      <ol className="wx-onboard-steps">
        {WALLET_STEPS.map((key, i) => (
          <li key={key} className={i <= idx ? 'done' : info.status === 'error' && i === idx + 1 ? 'bad' : ''}>
            <span className="wx-onboard-n">{i + 1}</span>
            <span>{t(`onboard.step.${key}`)}</span>
          </li>
        ))}
      </ol>
      {info.busy ? <p className="muted-text">{t('onboard.inProgress')}</p> : null}
      {info.error ? <p className="auth-error">{info.error}</p> : null}
      {msg ? <p className="auth-error">{msg}</p> : null}
      {okMsg ? <p className="wx-account-ok">{okMsg}</p> : null}
      <div className="wx-onboard-actions">
        <button type="button" className="btn-primary" disabled={waiting} onClick={() => void runWallet()}>
          {waiting ? t('onboard.running') : t('onboard.continue')}
        </button>
      </div>
    </section>
  );
}
