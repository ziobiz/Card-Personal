import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Member = {
  id: string;
  email: string;
  wirexUserId?: string;
  source: string;
  partnerId?: string;
  partnerName?: string;
  country?: string;
  kycStatus?: string;
  status: string;
  createdAt: string;
};

export default function AdminMembers({ source }: { source: 'direct' | 'partner' }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.admin
      .getMembers(source)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [source]);

  return (
    <div>
      <p className="muted-text">{source === 'direct' ? t('admin.membersDirectDesc') : t('admin.membersPartnerDesc')}</p>
      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : (
        <div className="card-surface" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colEmail')}</th>
                {source === 'partner' && <th>{t('admin.colPartner')}</th>}
                <th>{t('admin.colWirexId')}</th>
                <th>KYC</th>
                <th>{t('admin.colStatus')}</th>
                <th>{t('admin.colJoined')}</th>
                <th>{t('admin.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  {source === 'partner' && <td>{m.partnerName || m.partnerId || '-'}</td>}
                  <td className="mono">{m.wirexUserId || '-'}</td>
                  <td>{m.kycStatus || '-'}</td>
                  <td>
                    <select
                      className="admin-status-select"
                      value={m.status}
                      onChange={async (e) => {
                        await api.admin.updateMember(m.id, { status: e.target.value });
                        load();
                      }}
                    >
                      <option value="active">{t('admin.statusActive')}</option>
                      <option value="suspended">{t('admin.statusSuspended')}</option>
                    </select>
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-outline btn-compact"
                      onClick={async () => {
                        if (!window.confirm(t('admin.resetOtpConfirm', { email: m.email }))) return;
                        await api.admin.resetMemberOtp(m.id);
                        load();
                      }}
                    >
                      {t('admin.resetOtpBtn')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p className="muted-text empty-text">{t('admin.noMembers')}</p>}
        </div>
      )}
    </div>
  );
}
