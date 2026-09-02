import { useTranslation } from 'react-i18next';
import type { Card } from '../api';
import { ApplePayIcon, DepositIcon, FreezeIcon, GooglePayIcon, LimitIcon } from './BrandIcons';

type Props = {
  card: Card | null;
  open: boolean;
  onClose: () => void;
  onDeposit: () => void;
  onLimit: () => void;
  onBlockToggle: () => void;
  onApplePay: () => void;
  onGooglePay: () => void;
};

export default function CardActionSheet({
  card,
  open,
  onClose,
  onDeposit,
  onLimit,
  onBlockToggle,
  onApplePay,
  onGooglePay,
}: Props) {
  const { t } = useTranslation();
  if (!open || !card) return null;

  const active = card.status === 'active';
  const blocked = card.status === 'blocked';

  return (
    <div className="wx-sheet-overlay" onClick={onClose} role="presentation">
      <div className="wx-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="wx-sheet-handle" />
        <h3 className="wx-sheet-title">
          Visa •••• {card.panLast4}
        </h3>
        <p className="muted-text wx-sheet-sub">{t('cards.actionMenuIntro')}</p>
        <div className="wx-action-grid">
          <button type="button" className="wx-action-item" onClick={onDeposit}>
            <span className="wx-action-ico"><DepositIcon /></span>
            <span>{t('cards.depositShort')}</span>
          </button>
          {card.status !== 'closed' && (
            <button type="button" className="wx-action-item" onClick={onLimit}>
              <span className="wx-action-ico"><LimitIcon /></span>
              <span>{t('cards.limitAction')}</span>
            </button>
          )}
          {(active || blocked) && (
            <button type="button" className="wx-action-item" onClick={onBlockToggle}>
              <span className="wx-action-ico"><FreezeIcon /></span>
              <span>{blocked ? t('cards.unblock') : t('cards.block')}</span>
            </button>
          )}
          {active && (
            <>
              <button type="button" className="wx-action-item wx-action-apple" onClick={onApplePay}>
                <span className="wx-action-ico"><ApplePayIcon /></span>
                <span>Apple Pay</span>
              </button>
              <button type="button" className="wx-action-item wx-action-google" onClick={onGooglePay}>
                <span className="wx-action-ico"><GooglePayIcon /></span>
                <span>Google Pay</span>
              </button>
            </>
          )}
        </div>
        <button type="button" className="btn-secondary wx-sheet-close" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
