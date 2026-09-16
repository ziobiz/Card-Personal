import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Card } from '../../api';
import { kickToAdminLogin } from '../../lib/adminSession';
import { EntityFilterBar } from '../../components/EntityFilterBar';
import { EMPTY_ENTITY_FILTER, filterByEntity, type EntityFilterState } from '../../lib/dateRange';

type CardRow = { userId: string; email: string; card: Card };

export default function AdminCards() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardType, setCardType] = useState('all');
  const [applied, setApplied] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);
  const [draft, setDraft] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);

  const load = () => {
    setLoading(true);
    api.admin
      .getCards()
      .then((r) => setCards(r.items))
      .catch((e) => {
        const msg = (e as Error).message || '';
        if (msg.includes('Admin') || msg.includes('403') || msg.includes('Unauthorized')) {
          kickToAdminLogin();
        }
        setCards([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      filterByEntity(cards, applied, {
        date: (row) => row.card.createdAt,
        status: (row) => row.card.status,
        text: (row, field) => {
          if (field === 'email') return row.email;
          if (field === 'last4') return row.card.panLast4 || '';
          return `${row.email} ${row.card.panLast4 || ''} ${row.card.id}`;
        },
      }).filter((row) => (cardType === 'all' ? true : row.card.type === cardType)),
    [cards, applied, cardType]
  );

  const counts = useMemo(() => {
    const virtual = cards.filter((c) => c.card.type === 'virtual').length;
    const plastic = cards.filter((c) => c.card.type === 'plastic').length;
    const active = cards.filter((c) => c.card.status === 'active').length;
    const blocked = cards.filter((c) => c.card.status === 'blocked').length;
    return { virtual, plastic, active, blocked, total: cards.length };
  }, [cards]);

  return (
    <div>
      <p className="hq-card-hint">{t('admin.cardsDesc')}</p>
      <div className="card-issue-pills">
        <div className="card-issue-pill">
          <strong>{counts.total}</strong>
          <span>{t('admin.statCards')}</span>
        </div>
        <div className="card-issue-pill">
          <strong>{counts.virtual}</strong>
          <span>{t('admin.cardVirtual')}</span>
        </div>
        <div className="card-issue-pill">
          <strong>{counts.plastic}</strong>
          <span>{t('admin.cardPlastic')}</span>
        </div>
        <div className="card-issue-pill">
          <strong>{counts.active}</strong>
          <span>{t('admin.statActive')}</span>
        </div>
        <div className="card-issue-pill">
          <strong>{counts.blocked}</strong>
          <span>{t('admin.cardBlocked')}</span>
        </div>
      </div>
      <EntityFilterBar
        value={draft}
        onChange={setDraft}
        onSearch={() => {
          setApplied(draft);
          load();
        }}
        onReset={() => {
          setApplied(EMPTY_ENTITY_FILTER);
          setCardType('all');
        }}
        dateFieldOptions={[{ value: 'createdAt', label: t('admin.colIssued') }]}
        searchFieldOptions={[
          { value: 'all', label: t('admin.filterAll') },
          { value: 'email', label: t('admin.colEmail') },
          { value: 'last4', label: t('admin.colLast4') },
        ]}
        statusOptions={[
          { value: 'active', label: t('admin.statusActive') },
          { value: 'inactive', label: t('admin.statusInactive') },
          { value: 'blocked', label: t('admin.cardBlocked') },
          { value: 'closed', label: t('admin.cardClosed') },
        ]}
        extraFields={
          <label>
            <span>{t('admin.colCardType')}</span>
            <select className="input" value={cardType} onChange={(e) => setCardType(e.target.value)}>
              <option value="all">{t('admin.filterAll')}</option>
              <option value="virtual">{t('admin.cardVirtual')}</option>
              <option value="plastic">{t('admin.cardPlastic')}</option>
            </select>
          </label>
        }
      />
      <p className="entity-filter-count">{t('admin.filterCount', { n: filtered.length })}</p>
      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colUser')}</th>
                <th>{t('admin.colCardType')}</th>
                <th>{t('admin.colCard')}</th>
                <th>{t('admin.colStatus')}</th>
                <th>{t('admin.colBalance')}</th>
                <th>{t('admin.colLimit')}</th>
                <th>{t('admin.colIssued')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ email, card }) => (
                <tr key={card.id}>
                  <td>{email}</td>
                  <td>{card.type === 'plastic' ? t('admin.cardPlastic') : t('admin.cardVirtual')}</td>
                  <td className="mono">Visa •••• {card.panLast4}</td>
                  <td>
                    <span className={`hq-pill ${card.status === 'active' ? 'ok' : card.status === 'blocked' ? 'bad' : 'warn'}`}>
                      {t(`cards.status.${card.status}`, { defaultValue: card.status })}
                    </span>
                  </td>
                  <td>{(card.balance ?? 0).toLocaleString()} {card.currency}</td>
                  <td>{(card.dailyLimit ?? card.limit ?? 0).toLocaleString()}</td>
                  <td>{card.createdAt ? new Date(card.createdAt).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="muted-text empty-text">{t('admin.noCards')}</p>}
        </div>
      )}
    </div>
  );
}
