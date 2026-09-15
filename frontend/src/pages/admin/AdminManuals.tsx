import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import ManualFrame, { type ManualCard } from '../../components/ManualFrame';

export default function AdminManuals() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ManualCard[]>([]);
  const [active, setActive] = useState('customer');

  useEffect(() => {
    api.admin
      .getManuals()
      .then((r) => {
        setItems(r.items);
        if (r.items[0]) setActive(r.items[0].id);
      })
      .catch(() => setItems([]));
  }, []);

  const shown = items.filter((m) => m.id === active);

  return (
    <div>
      <p className="muted-text">{t('manual.hqHint')}</p>
      <div className="manual-pick">
        {items.map((m) => (
          <button key={m.id} type="button" className={m.id === active ? 'on' : ''} onClick={() => setActive(m.id)}>
            {t(`manual.id.${m.id}`, { defaultValue: m.id })}
          </button>
        ))}
      </div>
      <ManualFrame manuals={shown.length ? shown : items} />
    </div>
  );
}
