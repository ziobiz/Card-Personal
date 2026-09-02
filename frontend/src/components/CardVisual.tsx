/**
 * Wirex One 톤 카드 비주얼 — 발급된 카드 + 샘플(발급 유도) 공용
 */

import { useTranslation } from 'react-i18next';
import { useBrand } from '../brand/BrandContext';

export interface CardVisualProps {
  panLast4?: string;
  status?: 'active' | 'inactive' | 'blocked' | 'closed';
  currency?: string;
  type?: 'virtual' | 'plastic';
  variant?: 'dark' | 'blue' | 'purple' | 'virtual' | 'metal';
  preview?: boolean;
  className?: string;
}

const VARIANTS: Record<string, string> = {
  dark: 'linear-gradient(145deg, #161311 0%, #3a2f26 42%, #1a1612 100%)',
  blue: 'linear-gradient(145deg, #1a1714 0%, #5c4a38 50%, #241c16 100%)',
  purple: 'linear-gradient(145deg, #1c1612 0%, #8a6a4a 48%, #2a211a 100%)',
  virtual:
    'linear-gradient(135deg, rgba(28,28,32,0.95) 0%, rgba(72,58,48,0.9) 40%, rgba(20,18,16,0.98) 100%)',
  metal:
    'linear-gradient(145deg, #2a2a2e 0%, #c4a484 28%, #8a7358 52%, #3a342e 78%, #121014 100%)',
};

function ChipIcon() {
  return (
    <svg className="card-visual-chip" viewBox="0 0 50 38" width="42" height="32" aria-hidden>
      <rect x="1" y="1" width="48" height="36" rx="6" fill="url(#chipGrad)" stroke="rgba(0,0,0,0.25)" />
      <path d="M1 12h48M1 26h48M18 1v36M32 1v36" stroke="rgba(90,60,20,0.35)" strokeWidth="1.2" />
      <defs>
        <linearGradient id="chipGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6e7c8" />
          <stop offset="50%" stopColor="#d4b483" />
          <stop offset="100%" stopColor="#a88452" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ContactlessIcon() {
  return (
    <svg className="card-visual-wave" viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M8 8c2.2 2.2 2.2 5.8 0 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.2 5.5c3.6 3.6 3.6 9.4 0 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.4 3c5 5 5 13 0 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function CardVisual({
  panLast4 = '4242',
  status = 'active',
  currency = 'USD',
  type = 'virtual',
  variant,
  preview = false,
  className = '',
}: CardVisualProps) {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const resolvedVariant = variant || (type === 'plastic' ? 'metal' : 'virtual');
  const bg = VARIANTS[resolvedVariant] || VARIANTS.dark;
  const last4 = panLast4 || '4242';

  return (
    <div
      className={`card-visual card-visual-${type} ${preview ? 'card-visual-preview' : ''} ${className}`.trim()}
      style={{ background: bg }}
    >
      <div className="card-visual-sheen" aria-hidden />
      <div className="card-visual-header">
        <span className="card-visual-brand">{brand.cardBrandName || brand.productName || 'ICOCARD'}</span>
        {preview ? (
          <span className="card-visual-badge-preview">
            {type === 'plastic' ? t('cards.samplePlastic') : t('cards.sampleVirtual')}
          </span>
        ) : (
          <span className={`card-visual-status badge badge-${status}`}>
            {t(`cards.status.${status}`)}
          </span>
        )}
      </div>

      <div className="card-visual-mid">
        <ChipIcon />
        <ContactlessIcon />
      </div>

      <div className="card-visual-pan">•••• •••• •••• {last4}</div>

      <div className="card-visual-footer">
        <div className="card-visual-holder">
          <span className="card-visual-holder-label">{preview ? t('cards.sampleName') : t('cards.cardHolder')}</span>
          <span className="card-visual-holder-name">
            {preview ? (type === 'plastic' ? 'PREMIUM MEMBER' : 'DIGITAL MEMBER') : 'CARD HOLDER'}
          </span>
        </div>
        <div className="card-visual-right">
          <span className="card-visual-type">
            {type === 'plastic' ? t('cards.typePlastic') : t('cards.typeVirtual')} · {currency}
          </span>
          <span className="card-visual-network">VISA</span>
        </div>
      </div>
    </div>
  );
}
