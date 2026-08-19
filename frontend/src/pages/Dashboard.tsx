import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type Card, type TokenBalance } from '../api';

export default function Dashboard() {
  const [kycUrl, setKycUrl] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(false);

  const handleKycClick = async () => {
    setKycLoading(true);
    try {
      const { url } = await api.kyc.getVerificationLink();
      if (url) window.location.href = url;
    } finally {
      setKycLoading(false);
    }
  };

  const { t } = useTranslation();
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
    api.kyc.getVerificationLink().then((r) => setKycUrl(r.url || null)).catch(() => {});
  }, []);

  const totalUsd =
    (walletBalance?.primary?.reduce((s, t) => s + t.balance, 0) ?? 0) +
    (walletBalance?.cardSummaries?.reduce((s, c) => s + c.balance, 0) ?? 0);

  return (
    <div className="app-container wx-home">
      {kycUrl && (
        <div className="card-surface wx-kyc">
          <span>{t('dashboard.kycNeeded')}</span>
          <button onClick={handleKycClick} disabled={kycLoading} className="btn-primary btn-compact">
            {kycLoading ? t('common.loading') : t('dashboard.kycCta')}
          </button>
        </div>
      )}
      <div className="wx-home-hero">
        <p className="wx-kicker">{t('dashboard.totalBalance')}</p>
        <h1 className="wx-balance">${loading ? '—' : totalUsd.toLocaleString()}</h1>
        <div className="wx-actions">
          <Link to="/cards" className="btn-primary">
            {t('dashboard.addFunds')}
          </Link>
          <Link to="/earn" className="wx-ghost">
            {t('nav.earn')}
          </Link>
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
                  <Link key={tok.symbol} to="/cards" className="wallet-token-chip">
                    {tok.symbol}: {tok.balance.toLocaleString()}
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="muted-text">{t('common.loading')}</p>
          )}
        </div>
        <div className="card-surface">
          <h3 className="section-title">{t('dashboard.linkedCards')}</h3>
          {walletBalance?.cardSummaries.length ? (
            walletBalance.cardSummaries.map((c) => (
              <Link key={c.cardId} to="/cards" className="wx-list-row">
                <span>Visa ···· {c.panLast4}</span>
                <span className="muted-text">
                  {c.balance.toLocaleString()} {c.currency}
                </span>
              </Link>
            ))
          ) : (
            <p className="muted-text">{t('dashboard.noCards')}</p>
          )}
        </div>
      </div>

      <div className="card-surface" style={{ marginTop: '0.85rem' }}>
        <div className="section-header">
          <h2 className="section-title">{t('dashboard.recentActivity')}</h2>
          <Link to="/activity" className="section-link">
            {t('dashboard.viewAll')}
          </Link>
        </div>
        {loading ? (
          <p className="muted-text">{t('common.loading')}</p>
        ) : cards.length === 0 ? (
          <p className="muted-text">
            {t('dashboard.noActivity')}{' '}
            <Link to="/cards" className="primary-link">
              {t('dashboard.issueCard')}
            </Link>
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
