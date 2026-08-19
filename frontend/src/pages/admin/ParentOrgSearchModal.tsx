import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

export type ParentOrg = { id: string; name: string; orgLevel: string; code?: string };

export default function ParentOrgSearchModal({
  open,
  forLevel,
  onClose,
  onSelect,
}: {
  open: boolean;
  forLevel: string;
  onClose: () => void;
  onSelect: (org: ParentOrg) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ParentOrg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setLoading(true);
    api.admin
      .getOrgParents(forLevel || 'MERCHANT')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, forLevel]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.code || '').toLowerCase().includes(s) ||
        t(`admin.orgLevel.${p.orgLevel}`).toLowerCase().includes(s)
    );
  }, [items, q, t]);

  if (!open) return null;

  return (
    <div className="pg-modal-overlay" onClick={onClose} role="presentation">
      <div className="pg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pg-modal-head">
          <h3>{t('admin.parentSearchTitle')}</h3>
          <button type="button" className="pg-modal-close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        <div className="pg-modal-search">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.parentSearchPh')}
            autoFocus
          />
          <button type="button" className="btn-primary">{t('admin.search')}</button>
        </div>
        <div className="pg-modal-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colSelect')}</th>
                <th>{t('admin.orgCode')}</th>
                <th>{t('admin.orgName')}</th>
                <th>{t('admin.orgLevelLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>{t('common.loading')}</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>{t('admin.noParentOrgs')}</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} onClick={() => onSelect(p)}>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => onSelect(p)}>
                        {t('admin.colSelect')}
                      </button>
                    </td>
                    <td className="mono">{p.code || p.id}</td>
                    <td>{p.name}</td>
                    <td>{t(`admin.orgLevel.${p.orgLevel}`)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="pg-modal-hint">{t('admin.parentSearchHint')}</p>
      </div>
    </div>
  );
}
