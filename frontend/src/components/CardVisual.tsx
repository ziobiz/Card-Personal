/**
 * Wirex 스타일 카드 비주얼 컴포넌트
 * app.wirexapp.com Cards UI 참조
 */

import { useTranslation } from 'react-i18next';
import { useBrand } from '../brand/BrandContext';

export interface CardVisualProps {
  panLast4: string;
  status: 'active' | 'inactive' | 'blocked' | 'closed';
  currency: string;
  type?: 'virtual' | 'plastic';
  variant?: 'dark' | 'blue' | 'purple';
}

const VARIANTS = {
  dark: 'linear-gradient(145deg, #161311 0%, #3a2f26 42%, #1a1612 100%)',
  blue: 'linear-gradient(145deg, #1a1714 0%, #5c4a38 50%, #241c16 100%)',
  purple: 'linear-gradient(145deg, #1c1612 0%, #8a6a4a 48%, #2a211a 100%)',
};

export default function CardVisual({
  panLast4,
  status,
  currency,
  type = 'virtual',
  variant = 'dark',
}: CardVisualProps) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const bg = VARIANTS[variant];

  return (
    <div
      className="card-visual"
      style={{ background: bg }}
    >
      <div className="card-visual-header">
        <span className="card-visual-brand">{brand.cardBrandName}</span>
        <span className={`card-visual-status badge badge-${status}`}>
          {t(`cards.status.${status}`)}
        </span>
      </div>
      <div className="card-visual-pan">•••• •••• •••• {panLast4}</div>
      <div className="card-visual-footer">
        <span className="card-visual-type">{type.toUpperCase()} · {currency}</span>
        <span className="card-visual-network">VISA</span>
      </div>
    </div>
  );
}
