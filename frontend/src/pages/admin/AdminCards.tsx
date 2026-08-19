import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type Card } from '../../api';

type CardRow = { userId: string; email: string; card: Card };

export default function AdminCards() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin
      .getCards()
      .then((r) => setCards(r.items))
      .catch((e) => {
        const msg = (e as Error).message || '';
        if (msg.includes('Admin') || msg.includes('403')) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
        }
        setCards([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">{t('admin.titleCards')}</h1>
        <Link to="/admin/dashboard" className="btn-outline">{t('admin.backDashboard')}</Link>
      </div>
      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colUser')}</th>
                <th>{t('admin.colCard')}</th>
                <th>{t('admin.colStatus')}</th>
                <th>{t('admin.colBalance')}</th>
                <th>{t('admin.colLimit')}</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(({ email, card }) => (
                <tr key={card.id}>
                  <td>{email}</td>
                  <td className="mono">Visa •••• {card.panLast4}</td>
                  <td>
                    <span className={`badge badge-${card.status}`}>
                      {t(`cards.status.${card.status}`, { defaultValue: card.status })}
                    </span>
                  </td>
                  <td>{(card.balance ?? 0).toLocaleString()} {card.currency}</td>
                  <td>{(card.dailyLimit ?? card.limit ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cards.length === 0 && <p className="muted-text empty-text">{t('admin.noCards')}</p>}
        </div>
      )}
    </div>
  );
}
