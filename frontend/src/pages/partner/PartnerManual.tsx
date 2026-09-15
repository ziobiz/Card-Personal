import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, fetchPublicBrand, type BrandConfig } from '../../api';
import ManualDoc, { type ManualAudience } from '../../components/ManualDoc';

function audienceFromDelivery(mode?: string): ManualAudience {
  if (mode === 'sub_solution_standalone') return 'standalone';
  if (mode === 'sub_solution') return 'sub';
  return 'api';
}

export default function PartnerManual() {
  const { t } = useTranslation();
  const [audience, setAudience] = useState<ManualAudience>('api');
  const [brandOverride, setBrandOverride] = useState<BrandConfig | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.partnerPortal
      .overview()
      .then(async (r) => {
        setAudience(audienceFromDelivery(r.credentials?.deliveryMode));
        const slug = r.credentials?.solutionSlug;
        if (slug) setBrandOverride(await fetchPublicBrand(slug));
      })
      .catch(() => setAudience('api'))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <p className="muted-text">{t('common.loading')}</p>;

  return (
    <div className="pp-card">
      <h1>{t('partner.navManual')}</h1>
      <ManualDoc audience={audience} showCustomerAlso brandOverride={brandOverride} />
    </div>
  );
}
