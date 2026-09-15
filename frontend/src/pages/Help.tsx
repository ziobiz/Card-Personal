import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import ManualFrame, { type ManualCard } from '../components/ManualFrame';

export default function Help() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ManualCard[]>([]);

  useEffect(() => {
    api.user
      .getManuals()
      .then((r) => setItems(r.items))
      .catch(() => setItems([{ id: 'customer', outlineKeys: ['manual.outCustomer1', 'manual.outCustomer2', 'manual.outCustomer3', 'manual.outCustomer4'] }]));
  }, []);

  return (
    <div>
      <h1 className="page-title">{t('manual.customerTitle')}</h1>
      <ManualFrame manuals={items} />
    </div>
  );
}
