import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

function labelOf(row: unknown, t: (k: string) => string): string {
  if (!row || typeof row !== 'object') return String(row);
  const o = row as Record<string, unknown>;
  const raw = String(o.type || o.kind || o.status || o.id || '');
  if (!raw) return t('activity.itemFallback');
  return raw;
}

function metaOf(row: unknown): string {
  if (!row || typeof row !== 'object') return '';
  const o = row as Record<string, unknown>;
  const amt = o.amount ?? o.value ?? o.billingAmount;
  const cur = o.currency ?? o.billingCurrency ?? '';
  const when = o.createdAt || o.timestamp || o.date;
  const parts = [
    amt != null ? `${amt} ${cur}`.trim() : '',
    when ? new Date(String(when)).toLocaleString() : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export default function Activity() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<unknown[]>([]);
  const [kyc, setKyc] = useState<string>('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    api.kyc.status().then((r) => setKyc(r.kycStatus)).catch(() => undefined);
    api.activities
      .list()
      .then((r) => setRows((r.data as unknown[]) || (r.items as unknown[]) || []))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="app-container">
      <h1 className="page-title">{t('activity.title')}</h1>
      <p className="muted-text" style={{ marginTop: 0 }}>
        {t('activity.intro')}
      </p>
      <p className="muted-text">
        {t('activity.kycLabel')}: {kyc}
      </p>
      {error && <p className="auth-error">{error}</p>}
      <div className="card-surface" style={{ marginTop: 12 }}>
        {rows.length === 0 ? (
          <p className="muted-text">{t('activity.empty')}</p>
        ) : (
          rows.slice(0, 50).map((r, i) => (
            <div key={i} className="wx-list-row">
              <span>{labelOf(r, t)}</span>
              <span className="muted-text">{metaOf(r)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
