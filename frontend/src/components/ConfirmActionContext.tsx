import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmActionModal, { type ConfirmActionRequest } from './ConfirmActionModal';

type Resolve = (ok: boolean) => void;

type ConfirmActionContextValue = {
  /** Show warning modal; resolves true on confirm, false on cancel. */
  requestConfirm: (req: ConfirmActionRequest) => Promise<boolean>;
};

const ConfirmActionContext = createContext<ConfirmActionContextValue | null>(null);

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState<ConfirmActionRequest>({ message: '' });
  const resolveRef = useRef<Resolve | null>(null);

  const close = useCallback((ok: boolean) => {
    setOpen(false);
    setBusy(false);
    const r = resolveRef.current;
    resolveRef.current = null;
    r?.(ok);
  }, []);

  const requestConfirm = useCallback((next: ConfirmActionRequest) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false);
      resolveRef.current = resolve;
      setReq(next);
      setBusy(false);
      setOpen(true);
    });
  }, []);

  const value = useMemo(() => ({ requestConfirm }), [requestConfirm]);

  return (
    <ConfirmActionContext.Provider value={value}>
      {children}
      <ConfirmActionModal
        open={open}
        busy={busy}
        title={req.title}
        message={req.message}
        confirmLabel={req.confirmLabel}
        cancelLabel={req.cancelLabel}
        danger={req.danger}
        onClose={() => close(false)}
        onConfirm={() => close(true)}
      />
    </ConfirmActionContext.Provider>
  );
}

export function useConfirmAction() {
  const ctx = useContext(ConfirmActionContext);
  if (!ctx) {
    return {
      requestConfirm: async (req: ConfirmActionRequest) =>
        typeof window !== 'undefined' ? window.confirm(req.message) : false,
    };
  }
  return ctx;
}

/** HQ/PG-style confirm helpers for main settings (not search / Hello / refresh). */
export function useHqConfirm() {
  const { requestConfirm } = useConfirmAction();
  const { t } = useTranslation();

  return useMemo(
    () => ({
      confirmSave: (message?: string) =>
        requestConfirm({
          title: t('admin.confirmActionTitle'),
          message: message || t('admin.confirmSave'),
          confirmLabel: t('common.confirm'),
          cancelLabel: t('common.cancel'),
        }),
      confirmApply: (message?: string) =>
        requestConfirm({
          title: t('admin.confirmActionTitle'),
          message: message || t('admin.confirmApply'),
          confirmLabel: t('common.confirm'),
          cancelLabel: t('common.cancel'),
        }),
      confirmDelete: (message?: string) =>
        requestConfirm({
          title: t('admin.confirmActionTitle'),
          message: message || t('admin.confirmDelete'),
          confirmLabel: t('common.confirm'),
          cancelLabel: t('common.cancel'),
          danger: true,
        }),
      confirmCancel: (message?: string) =>
        requestConfirm({
          title: t('admin.confirmActionTitle'),
          message: message || t('admin.confirmCancelChanges'),
          confirmLabel: t('common.confirm'),
          cancelLabel: t('common.cancel'),
        }),
      requestConfirm,
    }),
    [requestConfirm, t]
  );
}
