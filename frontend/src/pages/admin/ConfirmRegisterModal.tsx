import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ConfirmRegisterModal({
  open,
  busy,
  summary,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  summary?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  if (!open) return null;

  return (
    <div className="pg-modal-overlay" onClick={onClose} role="presentation">
      <div className="pg-modal pg-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="pg-modal-head">
          <h3>{t('admin.confirmRegisterTitle')}</h3>
          <button type="button" className="pg-modal-close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        <div className="pg-confirm-body">
          <p>{step === 1 ? t('admin.confirmRegister') : t('admin.confirmRegisterAgain')}</p>
          {summary ? <p className="muted-text">{summary}</p> : null}
        </div>
        <div className="pg-confirm-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          {step === 1 ? (
            <button type="button" className="btn-primary" onClick={() => setStep(2)}>
              {t('common.confirm')}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy}>
              {t('admin.register')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
