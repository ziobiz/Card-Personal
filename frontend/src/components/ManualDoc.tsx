import { useTranslation } from 'react-i18next';
import type { BrandConfig } from '../api';
import { useBrand } from '../brand/BrandContext';

export type ManualAudience = 'customer' | 'api' | 'sub' | 'standalone';

const SECTIONS: Record<ManualAudience, string[]> = {
  customer: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
  api: ['a1', 'a2', 'a3', 'a4', 'a5'],
  sub: ['s1', 's2', 's3', 's4'],
  standalone: ['t1', 't2', 't3', 't4'],
};

export default function ManualDoc({
  audience,
  showCustomerAlso = false,
  brandOverride,
}: {
  audience: ManualAudience;
  showCustomerAlso?: boolean;
  brandOverride?: BrandConfig;
}) {
  const { t } = useTranslation();
  const { brand: ctxBrand } = useBrand();
  const brand = brandOverride || ctxBrand;
  const logo = brand.logoLogin || brand.logoAdmin;
  const blocks: ManualAudience[] = showCustomerAlso && audience !== 'customer' ? [audience, 'customer'] : [audience];

  return (
    <article className="manual-doc">
      <header className="manual-doc-brand">
        {logo ? <img src={logo} alt={brand.productName} className="manual-doc-logo" /> : <strong>{brand.productName}</strong>}
        <div>
          <p className="manual-doc-product">{brand.productName}</p>
          <p className="muted-text">{brand.operatorName}</p>
        </div>
      </header>
      <p className="hq-card-hint">{t('manual.draftNote')}</p>
      {blocks.map((id) => (
        <section key={id} className="manual-doc-block">
          <h2>{t(`manual.${id}.title`)}</h2>
          <p className="muted-text">{t(`manual.${id}.lead`)}</p>
          <ol>
            {SECTIONS[id].map((sec) => (
              <li key={sec}>
                <h3>{t(`manual.${id}.${sec}Title`)}</h3>
                <p>{t(`manual.${id}.${sec}Body`)}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {brand.supportEmail ? (
        <p className="muted-text">
          {t('manual.support')}: {brand.supportEmail}
        </p>
      ) : null}
    </article>
  );
}
