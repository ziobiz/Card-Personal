import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';

export type ConfirmActionRequest = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions (delete) use danger styling on confirm */
  danger?: boolean;
};

type Props = ConfirmActionRequest & {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** PG-style single warning: Confirm / Cancel before applying main HQ changes. */
export default function ConfirmActionModal({
  open,
  busy,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="pg-modal-overlay" onClick={() => !busy && onClose()} role="presentation">
      <div
        className="pg-modal pg-confirm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="pg-modal-head">
          <h3 id={titleId}>{title || t('admin.confirmActionTitle')}</h3>
          <button
            type="button"
            className="pg-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <div className="pg-confirm-body">
          <p>{message}</p>
        </div>
        <div className="pg-confirm-actions">
          <button type="button" className="btn-secondary pg-confirm-btn" onClick={onClose} disabled={busy}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            className={danger ? 'btn-primary pg-confirm-btn pg-confirm-danger' : 'btn-primary pg-confirm-btn'}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
