import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import ManualFrame, { type ManualCard } from '../../components/ManualFrame';

export default function PartnerManual() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ManualCard[]>([]);

  useEffect(() => {
    api.partnerPortal
      .manuals()
      .then((r) => setItems(r.items))
      .catch(() =>
        setItems([
          { id: 'partner_api', outlineKeys: ['manual.outApi1', 'manual.outApi2', 'manual.outApi3'] },
          { id: 'customer', outlineKeys: ['manual.outCustomer1', 'manual.outCustomer2', 'manual.outCustomer3', 'manual.outCustomer4'] },
        ])
      );
  }, []);

  return (
    <div>
      <p className="muted-text">{t('manual.partnerHint')}</p>
      <ManualFrame manuals={items} />
    </div>
  );
}
