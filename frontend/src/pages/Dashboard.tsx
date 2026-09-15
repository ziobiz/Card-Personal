import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Card, type TokenBalance } from '../api';
import OnboardingPanel from './OnboardingPanel';
import { TLink } from '../components/TenantLink';

export default function Dashboard() {
  const { t } = useTranslation();
  const [kycNeeded, setKycNeeded] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycErr, setKycErr] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<{
    primary: TokenBalance[];
    cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
  } | null>(null);

  const handleKycClick = async () => {
    setKycLoading(true);
    setKycErr('');
    try {
      const { url, message } = await api.kyc.getVerificationLink();
      if (url) {
        window.location.assign(url);
        return;
      }
      setKycErr(message || t('dashboard.kycOpenFail'));
    } catch (e) {
      setKycErr((e as Error).message || t('dashboard.kycOpenFail'));
    } finally {
      setKycLoading(false);
    }
  };

  useEffect(() => {
    api.cards
      .list(1, 10)
      .then((r) => setCards(r.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.wallet.getBalance().then(setWalletBalance).catch(() => setWalletBalance(null));
  }, [cards]);

  useEffect(() => {
    api.user
      .onboarding()
      .then((r) => {
        const st = r.status || '';
        setKycNeeded(
          st === 'registered' || st === 'kyc' || (r.kycStatus !== 'verified' && Boolean(r.wirexUserId))
        );
      })
      .catch(() => setKycNeeded(false));
  }, []);

  const totalUsd =
    (walletBalance?.primary?.reduce((s, t) => s + t.balance, 0) ?? 0) +
    (walletBalance?.cardSummaries?.reduce((s, c) => s + c.balance, 0) ?? 0);

  return (
    <div className="app-container wx-home">
      <OnboardingPanel />
      {kycNeeded && (
        <div className="card-surface wx-kyc">
          <span>{t('dashboard.kycNeeded')}</span>
          <button type="button" onClick={() => void handleKycClick()} disabled={kycLoading} className="btn-primary btn-compact">
            {kycLoading ? t('common.loading') : t('dashboard.kycCta')}
          </button>
          {kycErr ? (
            <p className="auth-error" style={{ margin: '0.5rem 0 0', width: '100%' }}>
              {kycErr}
            </p>
          ) : null}
        </div>
      )}
      <div className="wx-home-hero">
        <p className="wx-kicker">{t('dashboard.totalBalance')}</p>
        <h1 className="wx-balance">${loading ? '—' : totalUsd.toLocaleString()}</h1>
        <div className="wx-actions">
          <TLink to="/cards/manage" className="btn-primary">
            {t('dashboard.addFunds')}
          </TLink>
          <TLink to="/earn" className="wx-ghost">
            {t('nav.earn')}
          </TLink>
        </div>
      </div>

      <div className="wx-grid wx-grid-2">
        <div className="card-surface">
          <h3 className="section-title">{t('dashboard.accounts')}</h3>
          {walletBalance ? (
            <>
              <div className="stat-label">{t('wallet.primaryWallet')}</div>
              <div className="wallet-tokens">
                {walletBalance.primary.map((tok) => (
                  <TLink key={tok.symbol} to="/wallet" className="wallet-token-chip">
                    {tok.symbol}: {tok.balance.toLocaleString()}
                  </TLink>
                ))}
              </div>
              <TLink to="/wallet" className="section-link" style={{ display: 'inline-block', marginTop: '0.65rem' }}>
                {t('wallet.manageLink')}
              </TLink>
            </>
          ) : (
            <p className="muted-text">{t('common.loading')}</p>
          )}
        </div>
        <div className="card-surface">
          <h3 className="section-title">{t('dashboard.linkedCards')}</h3>
          {walletBalance?.cardSummaries.length ? (
            walletBalance.cardSummaries.map((c) => (
              <TLink key={c.cardId} to="/cards/manage" className="wx-list-row">
                <span>Visa ···· {c.panLast4}</span>
                <span className="muted-text">
                  {c.balance.toLocaleString()} {c.currency}
                </span>
              </TLink>
            ))
          ) : (
            <p className="muted-text">{t('dashboard.noCards')}</p>
          )}
        </div>
      </div>

      <div className="card-surface" style={{ marginTop: '0.85rem' }}>
        <div className="section-header">
          <h2 className="section-title">{t('dashboard.recentActivity')}</h2>
          <TLink to="/activity" className="section-link">
            {t('dashboard.viewAll')}
          </TLink>
        </div>
        {loading ? (
          <p className="muted-text">{t('common.loading')}</p>
        ) : cards.length === 0 ? (
          <p className="muted-text">
            {t('dashboard.noActivity')}{' '}
            <TLink to="/cards/manage" className="primary-link">
              {t('dashboard.issueCard')}
            </TLink>
          </p>
        ) : (
          cards.slice(0, 5).map((card) => (
            <div key={card.id} className="wx-list-row">
              <span>···· {card.panLast4}</span>
              <span className={`badge badge-${card.status}`}>{t(`cards.status.${card.status}`)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
