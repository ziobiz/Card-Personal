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
  otpEnabled?: boolean;
  status: string;
  createdAt: string;
};

export default function AdminMembers({ source }: { source?: 'direct' | 'partner' }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'direct' | 'partner'>(source || 'all');
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    api.admin
      .getMembers(filter === 'all' ? undefined : filter)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <div>
      <p className="hq-card-hint">{t('admin.customersDesc')}</p>
      <div className="hq-filter">
        <label>
          {t('admin.colChannel')}
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">{t('admin.filterAll')}</option>
            <option value="direct">{t('admin.channelDirect')}</option>
            <option value="partner">{t('admin.channelPartner')}</option>
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={load}>
          {t('admin.search')}
        </button>
      </div>
      {message ? <p className="muted-text">{message}</p> : null}
      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : (
        <div className="card-surface" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colEmail')}</th>
                <th>{t('admin.colChannel')}</th>
                <th>{t('admin.colPartner')}</th>
                <th>{t('admin.colWirexId')}</th>
                <th>KYC</th>
                <th>OTP</th>
                <th>{t('admin.colStatus')}</th>
                <th>{t('admin.colJoined')}</th>
                <th>{t('admin.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>{m.email}</td>
                  <td>{m.source === 'partner' ? t('admin.channelPartner') : t('admin.channelDirect')}</td>
                  <td>{m.partnerName || m.partnerId || '-'}</td>
                  <td className="mono">{m.wirexUserId || '-'}</td>
                  <td>{m.kycStatus || '-'}</td>
                  <td>{m.otpEnabled ? t('admin.otpOn') : t('admin.otpOff')}</td>
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
                        setMessage(t('admin.otpResetDone', { email: m.email }));
                        load();
                      }}
                    >
                      {t('admin.resetOtpBtn')}
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-compact"
                      onClick={async () => {
                        if (!window.confirm(t('admin.resetPwConfirm', { email: m.email }))) return;
                        const r = await api.admin.resetMemberPassword(m.id);
                        setMessage(t('admin.resetPwOnce', { email: r.email, password: r.password }));
                        load();
                      }}
                    >
                      {t('admin.resetPwBtn')}
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
