import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: string;
  buildingName?: string;
};

type DaumPostcodeCtor = new (opts: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void };

declare global {
  interface Window {
    daum?: { Postcode: DaumPostcodeCtor };
  }
}

function formatJpZip(zip: string): string {
  const d = zip.replace(/[^\d]/g, '');
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return zip;
}

export function loadDaumPostcode(): Promise<DaumPostcodeCtor> {
  if (window.daum?.Postcode) return Promise.resolve(window.daum.Postcode);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-daum-postcode]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.daum?.Postcode) resolve(window.daum.Postcode);
        else reject(new Error('postcode'));
      });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.async = true;
    s.dataset.daumPostcode = '1';
    s.onload = () => {
      if (window.daum?.Postcode) resolve(window.daum.Postcode);
      else reject(new Error('postcode'));
    };
    s.onerror = () => reject(new Error('postcode'));
    document.head.appendChild(s);
  });
}

export async function openKoreaPostcode(onPick: (zip: string, address: string) => void): Promise<void> {
  const Postcode = await loadDaumPostcode();
  new Postcode({
    oncomplete(data) {
      const addr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;
      const extra = data.buildingName ? ` (${data.buildingName})` : '';
      onPick(data.zonecode, `${addr}${extra}`.trim());
    },
  }).open();
}

export function JapanPostcodeModal({
  open,
  initialQuery,
  onClose,
  onPick,
}: {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
  onPick: (zip: string, address: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Array<{ zip: string; address: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setQ(initialQuery || '');
    setItems([]);
    setError('');
  }, [open, initialQuery]);

  const search = async () => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError('');
    try {
      const r = await api.admin.searchPostcode('JP', query);
      setItems(r.items);
      if (!r.items.length) setError(t('admin.zipNoResult'));
    } catch (e) {
      setItems([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="pg-modal-overlay" onClick={onClose} role="presentation">
      <div className="pg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pg-modal-head">
          <h3>{t('admin.zipSearchTitle')}</h3>
          <button type="button" className="pg-modal-close" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        <div className="pg-modal-search">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.zipSearchPhJp')}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                search();
              }
            }}
          />
          <button type="button" className="btn-primary" onClick={search} disabled={loading}>
            {t('admin.search')}
          </button>
        </div>
        <div className="pg-modal-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colSelect')}</th>
                <th>{t('admin.zip')}</th>
                <th>{t('admin.address')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3}>{t('common.loading')}</td>
                </tr>
              ) : error && !items.length ? (
                <tr>
                  <td colSpan={3}>{error}</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3}>{t('admin.zipSearchHintJp')}</td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr
                    key={`${it.zip}-${it.address}`}
                    className="pg-modal-row"
                    onClick={() => {
                      onPick(formatJpZip(it.zip), it.address);
                      onClose();
                    }}
                  >
                    <td>
                      <button type="button" className="btn-secondary">{t('admin.colSelect')}</button>
                    </td>
                    <td className="mono">{formatJpZip(it.zip)}</td>
                    <td>{it.address}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
