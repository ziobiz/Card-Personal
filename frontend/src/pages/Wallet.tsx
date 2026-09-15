import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type TokenBalance } from '../api';
import WalletModePanel from '../components/WalletModePanel';
import { TLink } from '../components/TenantLink';

type Onboard = {
  status: string;
  eoa: string;
  smartWallet: string;
  walletMode?: 'embedded' | 'external_eoa' | 'bridge';
  allowedWalletModes?: { embedded: boolean; externalEoa: boolean; bridge: boolean };
};

export default function Wallet() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<Onboard | null>(null);
  const [balance, setBalance] = useState<{
    primary: TokenBalance[];
    cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
  } | null>(null);

  const load = async () => {
    try {
      setInfo(await api.user.onboarding());
    } catch {
      setInfo(null);
    }
    try {
      setBalance(await api.wallet.getBalance());
    } catch {
      setBalance(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totalUsd =
    (balance?.primary?.reduce((s, t) => s + t.balance, 0) ?? 0) +
    (balance?.cardSummaries?.reduce((s, c) => s + c.balance, 0) ?? 0);

  return (
    <div className="app-container wx-wallet-page">
      <div className="page-header">
        <h1 className="page-title">{t('wallet.pageTitle')}</h1>
      </div>
      <p className="muted-text wx-wallet-page-lead">{t('wallet.pageLead')}</p>

      <section className="card-surface wx-wallet-summary">
        <div className="wx-wallet-summary-grid">
          <div>
            <p className="wx-kicker">{t('dashboard.totalBalance')}</p>
            <h2 className="wx-wallet-balance">${totalUsd.toLocaleString()}</h2>
          </div>
          <div className="wx-wallet-summary-actions">
            <TLink to="/cards/manage" className="btn-primary">
              {t('dashboard.addFunds')}
            </TLink>
            <TLink to="/cards/issue" className="wx-ghost">
              {t('nav.cardsIssue')}
            </TLink>
          </div>
        </div>
        {info?.eoa || info?.smartWallet ? (
          <div className="wx-wallet-addrs">
            {info.eoa ? (
              <p>
                <span>EOA</span>
                <code>{info.eoa}</code>
              </p>
            ) : null}
            {info.smartWallet ? (
              <p>
                <span>Smart Wallet</span>
                <code>{info.smartWallet}</code>
              </p>
            ) : null}
          </div>
        ) : null}
        {balance?.primary?.length ? (
          <div className="wallet-tokens" style={{ marginTop: '0.75rem' }}>
            {balance.primary.map((tok) => (
              <span key={tok.symbol} className="wallet-token-chip">
                {tok.symbol}: {tok.balance.toLocaleString()}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <WalletModePanel
        current={info?.walletMode || 'embedded'}
        allowed={info?.allowedWalletModes}
        onChanged={() => void load()}
      />
    </div>
  );
}
