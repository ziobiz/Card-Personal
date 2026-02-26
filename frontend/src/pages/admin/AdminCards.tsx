import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, type Card } from '../../api';

type CardRow = { userId: string; email: string; card: Card };

export default function AdminCards() {
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
        <h1 className="page-title">카드 관리</h1>
        <Link to="/admin/dashboard" className="btn-outline">← 대시보드</Link>
      </div>
      {loading ? (
        <p className="muted-text">로딩 중...</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>사용자</th>
                <th>카드</th>
                <th>상태</th>
                <th>잔액</th>
                <th>한도</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(({ email, card }) => (
                <tr key={card.id}>
                  <td>{email}</td>
                  <td className="mono">Visa •••• {card.panLast4}</td>
                  <td><span className={`badge badge-${card.status}`}>{card.status}</span></td>
                  <td>{(card.balance ?? 0).toLocaleString()} {card.currency}</td>
                  <td>{(card.dailyLimit ?? card.limit ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cards.length === 0 && <p className="muted-text empty-text">발급된 카드가 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
