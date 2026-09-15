import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Card, type TokenBalance } from '../api';
import { TLink } from '../components/TenantLink';

type Nudge = { title: string; body: string; to: string; cta: string } | null;

export default function Dashboard() {
  const { t } = useTranslation();
  const [nudge, setNudge] = useState<Nudge>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<{
    primary: TokenBalance[];
    cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
  } | null>(null);

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
    Promise.all([api.user.onboarding().catch(() => null), api.cards.list(1, 5).catch(() => null)]).then(
      ([onboard, cardRes]) => {
        if (!onboard || onboard.mock) {
          setNudge(null);
          return;
        }
        const hasWallet = Boolean(onboard.eoa || onboard.smartWallet);
        const kycDone = onboard.kycStatus === 'verified' || onboard.status === 'ready';
        const hasCards = Boolean(cardRes?.items?.length);
        if (!hasWallet) {
          setNudge({
            title: t('dashboard.nudgeWalletTitle'),
            body: t('dashboard.nudgeWalletBody'),
            to: '/wallet',
            cta: t('dashboard.nudgeWalletCta'),
          });
          return;
        }
        if (!kycDone) {
          setNudge({
            title: t('dashboard.nudgeKycTitle'),
            body: t('dashboard.nudgeKycBody'),
            to: '/account',
            cta: t('dashboard.kycCta'),
          });
          return;
        }
        if (!hasCards) {
          setNudge({
            title: t('dashboard.nudgeCardTitle'),
            body: t('dashboard.nudgeCardBody'),
            to: '/cards/issue',
            cta: t('dashboard.issueCard'),
          });
          return;
        }
        setNudge(null);
      }
    );
  }, [t]);

  const totalUsd =
    (walletBalance?.primary?.reduce((s, t) => s + t.balance, 0) ?? 0) +
    (walletBalance?.cardSummaries?.reduce((s, c) => s + c.balance, 0) ?? 0);

  return (
    <div className="app-container wx-home">
      {nudge ? (
        <div className="card-surface wx-kyc">
          <div>
            <strong>{nudge.title}</strong>
            <p className="muted-text" style={{ margin: '0.35rem 0 0' }}>
              {nudge.body}
            </p>
          </div>
          <TLink to={nudge.to} className="btn-primary btn-compact">
            {nudge.cta}
          </TLink>
        </div>
      ) : null}

      <div className="wx-home-hero">
        <p className="wx-kicker">{t('dashboard.totalBalance')}</p>
        <h1 className="wx-balance">${loading ? '—' : totalUsd.toLocaleString()}</h1>
        <div className="wx-actions">
          <TLink to="/wallet" className="btn-primary">
            {t('dashboard.addFunds')}
          </TLink>
          <TLink to="/cards/issue" className="wx-ghost">
            {t('nav.cards')}
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
            <p className="muted-text">
              {t('dashboard.noCards')}{' '}
              <TLink to="/cards/issue" className="primary-link">
                {t('dashboard.issueCard')}
              </TLink>
            </p>
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
          <p className="muted-text">{t('dashboard.noActivity')}</p>
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
