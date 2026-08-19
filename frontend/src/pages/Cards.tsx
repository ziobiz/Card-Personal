import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Card } from '../api';
import CardVisual from '../components/CardVisual';

export default function Cards() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [limitModal, setLimitModal] = useState<Card | null>(null);
  const [newLimit, setNewLimit] = useState('');
  const [depositModal, setDepositModal] = useState<Card | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);

  const fetchCards = () => {
    api.cards
      .list()
      .then((r) => setCards(r.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleIssue = async (type: 'virtual' | 'plastic' = 'virtual') => {
    setIssuing(true);
    try {
      if (type === 'plastic') {
        await api.cards.createPlastic({ card_name: 'Co-Brand Physical' });
      } else {
        await api.cards.createVirtual({ limit: 5000, currency: 'USD' });
      }
      fetchCards();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIssuing(false);
    }
  };

  const handleBlock = async (c: Card) => {
    if (!confirm(t('cards.confirmBlock'))) return;
    try {
      await api.cards.block(c.id);
      fetchCards();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleUnblock = async (c: Card) => {
    try {
      await api.cards.unblock(c.id);
      fetchCards();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleWallet = async (c: Card, wallet: 'apple_pay' | 'google_pay') => {
    try {
      await api.cards.provisionWallet(c.id, wallet);
      alert(wallet === 'apple_pay' ? 'Apple Pay 토큰이 발급되었습니다.' : 'Google Pay 토큰이 발급되었습니다.');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleSetLimit = async () => {
    if (!limitModal || !newLimit) return;
    const val = parseInt(newLimit, 10);
    if (isNaN(val) || val < 0) return;
    try {
      await api.cards.setLimit(limitModal.id, val);
      setLimitModal(null);
      setNewLimit('');
      fetchCards();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDeposit = async () => {
    if (!depositModal || !depositAmount) return;
    const val = parseFloat(depositAmount);
    if (isNaN(val) || val <= 0) return;
    setDepositing(true);
    try {
      await api.wallet.depositToCard(depositModal.id, val);
      setDepositModal(null);
      setDepositAmount('');
      fetchCards();
      alert(t('wallet.depositSuccess'));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDepositing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">{t('cards.title')}</h1>
      </div>

      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : cards.length === 0 ? (
        <div className="cards-wirex-layout">
          <div className="cards-row">
            <div className="card-tile card-tile-add">
              <button
                onClick={() => handleIssue('virtual')}
                disabled={issuing}
                className="card-add-button"
              >
                <span className="card-add-icon">+</span>
                <span className="card-add-text">{t('cards.issueVirtualShort')}</span>
              </button>
            </div>
            <div className="card-tile card-tile-add">
              <button
                onClick={() => handleIssue('plastic')}
                disabled={issuing}
                className="card-add-button"
              >
                <span className="card-add-icon">+</span>
                <span className="card-add-text">{t('cards.issuePlasticShort')}</span>
              </button>
            </div>
          </div>
          <p className="empty-text muted-text">{t('cards.noCards')}</p>
        </div>
      ) : (
        <div className="cards-wirex-layout">
          <div className="cards-row">
            {cards.map((card, idx) => (
              <div key={card.id} className="card-tile">
                <CardVisual
                  panLast4={card.panLast4}
                  status={card.status}
                  currency={card.currency}
                  type={card.type}
                  variant={['dark', 'blue', 'purple'][idx % 3] as 'dark' | 'blue' | 'purple'}
                />
                <div className="card-tile-label">Visa •••• {card.panLast4}</div>
                <div className="card-tile-meta">
                  {(card.balance ?? 0).toLocaleString()} {card.currency}
                  {(card.dailyLimit ?? card.limit) != null && (
                    <span className="card-limit-badge">
                      {t('cards.limitTypeDaily')}: {(card.dailyLimit ?? card.limit ?? 0).toLocaleString()} {card.currency}
                    </span>
                  )}
                </div>
                <div className="card-tile-actions">
                  <button
                    onClick={() => { setDepositModal(card); setDepositAmount(''); }}
                    className="btn-primary btn-compact"
                  >
                    {t('cards.depositShort')}
                  </button>
                  {card.status === 'blocked' ? (
                    <button onClick={() => handleUnblock(card)} className="btn-secondary">
                      {t('cards.unblock')}
                    </button>
                  ) : card.status === 'active' ? (
                    <button onClick={() => handleBlock(card)} className="btn-danger">
                      {t('cards.block')}
                    </button>
                  ) : null}
                  {card.status !== 'closed' && (
                    <button
                      onClick={() => { setLimitModal(card); setNewLimit(String(card.dailyLimit ?? card.limit ?? 5000)); }}
                      className="btn-outline"
                    >
                      {t('dashboard.manage')}
                    </button>
                  )}
                  {card.status === 'active' && (
                    <>
                      <button onClick={() => handleWallet(card, 'apple_pay')} className="btn-outline">
                        Apple Pay
                      </button>
                      <button onClick={() => handleWallet(card, 'google_pay')} className="btn-outline">
                        Google Pay
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div className="card-tile card-tile-add">
              <button
                onClick={() => handleIssue('virtual')}
                disabled={issuing}
                className="card-add-button"
              >
                <span className="card-add-icon">+</span>
                <span className="card-add-text">{t('cards.issueVirtualShort')}</span>
              </button>
            </div>
            <div className="card-tile card-tile-add">
              <button
                onClick={() => handleIssue('plastic')}
                disabled={issuing}
                className="card-add-button"
              >
                <span className="card-add-icon">+</span>
                <span className="card-add-text">{t('cards.issuePlasticShort')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {depositModal && (
        <div className="modal-overlay" onClick={() => setDepositModal(null)}>
          <div className="modal-content card-surface" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('wallet.depositModal')}</h3>
            <p className="muted-text modal-desc">
              •••• {depositModal.panLast4} · {depositModal.currency}
            </p>
            <p className="muted-text modal-desc">{t('wallet.depositNote')}</p>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              min={0}
              step={10}
              placeholder={t('wallet.depositAmount')}
              className="input modal-input"
            />
            <div className="modal-actions">
              <button onClick={() => setDepositModal(null)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={handleDeposit} disabled={depositing || !depositAmount} className="btn-primary">
                {depositing ? t('common.loading') : t('wallet.depositButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {limitModal && (
        <div className="modal-overlay" onClick={() => setLimitModal(null)}>
          <div className="modal-content card-surface" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('cards.changeLimitModal')}</h3>
            <p className="muted-text modal-desc">
              •••• {limitModal.panLast4}
            </p>
            <input
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              min={0}
              placeholder={t('cards.limitPlaceholder')}
              className="input modal-input"
            />
            <div className="modal-actions">
              <button onClick={() => setLimitModal(null)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={handleSetLimit} className="btn-primary">
                {t('common.change')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
