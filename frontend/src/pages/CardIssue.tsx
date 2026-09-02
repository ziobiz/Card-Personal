import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../api';
import IssueCardTile from '../components/IssueCardTile';

/** 카드 발급 신청 — 가상/실물 샘플 카드로 발급 */
export default function CardIssue() {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [issuing, setIssuing] = useState<'virtual' | 'plastic' | null>(null);

  const refresh = () => {
    api.cards
      .list()
      .then((r) => setCount(r.items.length))
      .catch(() => setCount(0));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleIssue = async (type: 'virtual' | 'plastic') => {
    setIssuing(type);
    try {
      if (type === 'plastic') {
        await api.cards.createPlastic({ card_name: 'Co-Brand Physical' });
      } else {
        await api.cards.createVirtual({ limit: 5000, currency: 'USD' });
      }
      refresh();
      alert(t('cards.issueSuccess'));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIssuing(null);
    }
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">{t('cards.issueTitle')}</h1>
      </div>
      <p className="muted-text" style={{ marginTop: 0 }}>
        {t('cards.issueIntro')}
      </p>
      <div className="cards-wirex-layout">
        <div className="cards-row">
          <IssueCardTile
            type="virtual"
            loading={issuing === 'virtual'}
            disabled={Boolean(issuing)}
            onClick={() => handleIssue('virtual')}
          />
          <IssueCardTile
            type="plastic"
            loading={issuing === 'plastic'}
            disabled={Boolean(issuing)}
            onClick={() => handleIssue('plastic')}
          />
        </div>
      </div>
      <div className="card-surface" style={{ marginTop: 16 }}>
        <p className="muted-text" style={{ margin: 0 }}>
          {t('cards.ownedCount', { count })}
        </p>
        <Link to="/cards/manage" className="wx-ghost" style={{ display: 'inline-block', marginTop: 10 }}>
          {t('cards.goManage')}
        </Link>
      </div>
    </div>
  );
}
