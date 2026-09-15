import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { TLink } from '../components/TenantLink';

type Onboard = {
  status: string;
  error: string | null;
  eoa: string;
  smartWallet: string;
  wirexUserId?: string | null;
  kycStatus?: string;
  walletMode?: 'embedded' | 'external_eoa' | 'bridge';
  allowedWalletModes?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
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

function openExternal(url: string) {
  // async 이후 window.open 은 팝업 차단됨 → 같은 탭 이동이 확실
  window.location.assign(url);
}

export default function OnboardingPanel() {
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

  if (!info) return null;

  const idx = stepIndex(info.status);
  const needsKyc = info.status === 'registered' || info.status === 'kyc';

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
      const err = e as Error & { body?: { message?: string; error?: string; needOnboard?: boolean } };
      const bodyMsg = err.body?.message || err.body?.error;
      setMsg(bodyMsg || err.message || t('onboard.kycNoLink'));
    } finally {
      setKycBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    setMsg('');
    setOkMsg('');
    try {
      // KYC 단계에서는 무거운 재온보딩보다 링크 오픈을 우선
      if (needsKyc && info.kycStatus !== 'verified') {
        try {
          const r = await api.kyc.getVerificationLink();
          if (r.url) {
            setOkMsg(t('onboard.kycOpening'));
            openExternal(r.url);
            return;
          }
        } catch {
          /* fall through to full onboard (e.g. mock wirex id cleanup) */
        }
      }

      const r = await api.user.onboard({ issueCard: info.kycStatus === 'verified' });
      setInfo({
        status: r.onboarding.status,
        error: r.onboarding.error,
        eoa: r.onboarding.eoa,
        smartWallet: r.onboarding.smartWallet,
        kycStatus: (r.onboarding as { kycStatus?: string }).kycStatus || info.kycStatus,
        wirexUserId: (r.onboarding as { wirexUserId?: string | null }).wirexUserId,
        mock: info.mock,
      });
      if (r.kycUrl) {
        setOkMsg(t('onboard.kycOpening'));
        openExternal(r.kycUrl);
        return;
      }
      if (!r.ok) {
        setMsg(r.kycError || r.onboarding.error || t('onboard.failed'));
      } else if (r.onboarding.status === 'registered' || r.onboarding.status === 'kyc') {
        setMsg(t('onboard.kycNoLink'));
      } else {
        setOkMsg(t('onboard.progressOk'));
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      void load();
    }
  };

  return (
    <>
      {info.mock || info.status === 'ready' ? null : (
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
          {okMsg ? <p className="wx-account-ok">{okMsg}</p> : null}
          <div className="wx-onboard-actions">
            <button type="button" className="btn-primary" disabled={busy || kycBusy} onClick={() => void run()}>
              {busy ? t('onboard.running') : needsKyc ? t('dashboard.kycCta') : t('onboard.continue')}
            </button>
            {needsKyc ? (
              <button type="button" className="wx-ghost" disabled={kycBusy || busy} onClick={() => void openKyc()}>
                {kycBusy ? t('common.loading') : t('onboard.kycRetry')}
              </button>
            ) : null}
            {needsKyc ? (
              <TLink to="/cards/issue" className="wx-ghost">
                {t('nav.cardsIssue')}
              </TLink>
            ) : null}
          </div>
        </section>
      )}
    </>
  );
}
