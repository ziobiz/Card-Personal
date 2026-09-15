import { useTranslation } from 'react-i18next';
import { resolveAdminShellLogo, resolveMemberShellLogo } from '../api';
import { useBrand } from '../brand/BrandContext';
import './ManualFrame.css';

export type ManualCard = {
  id: string;
  outlineKeys: string[];
};

const TITLE_KEY: Record<string, string> = {
  customer: 'manual.customerTitle',
  partner_api: 'manual.partnerApiTitle',
  partner_sub: 'manual.partnerSubTitle',
  partner_standalone: 'manual.partnerSoloTitle',
  hq_ops: 'manual.hqTitle',
};

export default function ManualFrame({ manuals }: { manuals: ManualCard[] }) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const logo = resolveAdminShellLogo(brand) || resolveMemberShellLogo(brand);

  return (
    <div className="manual-stack">
      {manuals.map((m) => (
        <article key={m.id} className="manual-frame">
          <div className="manual-frame-brand">
            {logo ? <img src={logo} alt={brand.productName} /> : <span className="manual-frame-brand-name">{brand.productName}</span>}
          </div>
          <span className="manual-badge">{t('manual.preparingBadge')}</span>
          <h1>{t(TITLE_KEY[m.id] || 'manual.title')}</h1>
          <p>{t('manual.preparing')}</p>
          <ol>
            {m.outlineKeys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
