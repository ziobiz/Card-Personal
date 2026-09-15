import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

type Mode = 'embedded' | 'external_eoa' | 'bridge';

type Allowed = { embedded: boolean; externalEoa: boolean; bridge: boolean };

type Props = {
  current?: Mode;
  allowed?: Allowed;
  onChanged?: () => void;
};

export default function WalletModePanel({ current = 'embedded', allowed, onChanged }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(current);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [amount, setAmount] = useState('10');
  const [bridgeItems, setBridgeItems] = useState<Array<{ id: string; amount: number; currency: string; status: string; direction: string; createdAt: string }>>([]);
  const [policy, setPolicy] = useState<Allowed>(allowed ?? { embedded: true, externalEoa: true, bridge: true });

  useEffect(() => {
    if (allowed) setPolicy(allowed);
  }, [allowed]);

  useEffect(() => {
    if (allowed) return;
    api.user.onboarding().then((r) => {
      if (r.allowedWalletModes) setPolicy(r.allowedWalletModes);
    }).catch(() => undefined);
  }, [allowed]);

  useEffect(() => {
    setMode(current);
  }, [current]);

  useEffect(() => {
    api.user.bridgeLedger().then((r) => setBridgeItems(r.items || [])).catch(() => setBridgeItems([]));
  }, [mode]);

  const after = async (next: Mode) => {
    setMode(next);
    onChanged?.();
  };

  const useEmbedded = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api.user.walletEmbedded();
      setMsg(t('walletMode.embeddedDone'));
      await after('embedded');
    } catch (e) {
      const text = (e as Error).message || '';
      setErr(/already in progress/i.test(text) ? t('onboard.inProgress') : text);
    } finally {
      setBusy(false);
    }
  };

  const connectExternal = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const eth = window.ethereum;
      if (!eth?.request) {
        setErr(t('walletMode.needMetamask'));
        return;
      }
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts?.[0];
      if (!address) {
        setErr(t('walletMode.needMetamask'));
        return;
      }
      const { message } = await api.user.walletChallenge();
      const signature = (await eth.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;
      await api.user.walletConnect(address, signature);
      setMsg(t('walletMode.externalDone'));
      await after('external_eoa');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const bridgeTopup = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const amt = Number(amount);
      await api.user.bridgeTopup(amt, 'USD');
      const led = await api.user.bridgeLedger();
      setBridgeItems(led.items || []);
      setMsg(t('walletMode.bridgeDone'));
      await after('bridge');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-surface wx-wallet-modes">
      <h3 className="section-title">{t('walletMode.title')}</h3>
      <p className="muted-text">{t('walletMode.lead')}</p>
      <p className="muted-text wx-wallet-spend">{t('walletMode.spendNote')}</p>
      <div className="wx-wallet-grid">
        {policy.embedded ? (
          <article className={mode === 'embedded' ? 'on' : ''}>
            <h4>{t('walletMode.embedded')}</h4>
            <p>{t('walletMode.embeddedDesc')}</p>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void useEmbedded()}>
              {busy && mode !== 'embedded' ? t('common.loading') : t('walletMode.useEmbedded')}
            </button>
          </article>
        ) : null}
        {policy.externalEoa ? (
          <article className={mode === 'external_eoa' ? 'on' : ''}>
            <h4>{t('walletMode.external')}</h4>
            <p>{t('walletMode.externalDesc')}</p>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void connectExternal()}>
              {t('walletMode.connectWallet')}
            </button>
          </article>
        ) : null}
        {policy.bridge ? (
          <article className={mode === 'bridge' ? 'on' : ''}>
            <h4>{t('walletMode.bridge')}</h4>
            <p>{t('walletMode.bridgeDesc')}</p>
            <label>
              <span>{t('walletMode.amount')}</span>
              <input className="input" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void bridgeTopup()}>
              {t('walletMode.bridgeTopup')}
            </button>
          </article>
        ) : null}
      </div>
      {!policy.embedded && !policy.externalEoa && !policy.bridge ? (
        <p className="auth-error">{t('walletMode.noneEnabled')}</p>
      ) : null}
      {msg ? <p className="admin-settings-success">{msg}</p> : null}
      {err ? <p className="auth-error">{err}</p> : null}
      {bridgeItems.length ? (
        <ul className="wx-bridge-list">
          {bridgeItems.slice(0, 6).map((x) => (
            <li key={x.id}>
              {x.direction} {x.amount} {x.currency} · {x.status}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
