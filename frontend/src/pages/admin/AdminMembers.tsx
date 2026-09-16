import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { EntityFilterBar } from '../../components/EntityFilterBar';
import { useHqConfirm } from '../../components/ConfirmActionContext';
import { EMPTY_ENTITY_FILTER, filterByEntity, type EntityFilterState } from '../../lib/dateRange';

type Member = {
  id: string;
  email: string;
  displayName?: string;
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
  const { confirmApply } = useHqConfirm();
  const [channel, setChannel] = useState<'all' | 'direct' | 'partner'>(source || 'all');
  const [kyc, setKyc] = useState('all');
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [applied, setApplied] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);
  const [draft, setDraft] = useState<EntityFilterState>(EMPTY_ENTITY_FILTER);

  const load = () => {
    setLoading(true);
    api.admin
      .getMembers(channel === 'all' ? undefined : channel)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [channel]);

  const filtered = useMemo(
    () =>
      filterByEntity(items, applied, {
        date: (m) => m.createdAt,
        status: (m) => m.status,
        text: (m, field) => {
          if (field === 'email') return m.email;
          if (field === 'name') return m.displayName || '';
          if (field === 'wirex') return m.wirexUserId || '';
          if (field === 'partner') return `${m.partnerName || ''} ${m.partnerId || ''}`;
          return `${m.email} ${m.displayName || ''} ${m.wirexUserId || ''} ${m.partnerName || ''} ${m.partnerId || ''}`;
        },
      }).filter((m) => (kyc === 'all' ? true : (m.kycStatus || '') === kyc)),
    [items, applied, kyc]
  );

  return (
    <div>
      <p className="hq-card-hint">{t('admin.customersDesc')}</p>
      <EntityFilterBar
        value={draft}
        onChange={setDraft}
        onSearch={() => {
          setApplied(draft);
          load();
        }}
        onReset={() => {
          setApplied(EMPTY_ENTITY_FILTER);
          setKyc('all');
          setChannel(source || 'all');
        }}
        dateFieldOptions={[{ value: 'createdAt', label: t('admin.colJoined') }]}
        searchFieldOptions={[
          { value: 'all', label: t('admin.filterAll') },
          { value: 'email', label: t('admin.colEmail') },
          { value: 'name', label: t('admin.operatorName') },
          { value: 'wirex', label: t('admin.colWirexId') },
          { value: 'partner', label: t('admin.colPartner') },
        ]}
        statusOptions={[
          { value: 'pending', label: t('admin.statusPending') },
          { value: 'active', label: t('admin.statusActive') },
          { value: 'suspended', label: t('admin.statusSuspended') },
          { value: 'rejected', label: t('admin.statusRejected') },
        ]}
        extraFields={
          <>
            <label>
              <span>{t('admin.colChannel')}</span>
              <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="all">{t('admin.filterAll')}</option>
                <option value="direct">{t('admin.channelDirect')}</option>
                <option value="partner">{t('admin.channelPartner')}</option>
              </select>
            </label>
            <label>
              <span>KYC</span>
              <select className="input" value={kyc} onChange={(e) => setKyc(e.target.value)}>
                <option value="all">{t('admin.filterAll')}</option>
                <option value="pending">{t('admin.statusPending')}</option>
                <option value="verified">{t('admin.kycVerified')}</option>
                <option value="rejected">{t('admin.statusRejected')}</option>
              </select>
            </label>
          </>
        }
      />
      <p className="entity-filter-count">{t('admin.filterCount', { n: filtered.length })}</p>
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
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.email}
                    {m.displayName ? <div className="muted-text">{m.displayName}</div> : null}
                  </td>
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
                      <option value="pending">{t('admin.statusPending')}</option>
                      <option value="active">{t('admin.statusActive')}</option>
                      <option value="suspended">{t('admin.statusSuspended')}</option>
                      <option value="rejected">{t('admin.statusRejected')}</option>
                    </select>
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>
                    {m.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary btn-compact"
                          onClick={async () => {
                            await api.admin.updateMember(m.id, { status: 'active' });
                            setMessage(t('admin.memberApproved', { email: m.email }));
                            load();
                          }}
                        >
                          {t('admin.approveMember')}
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-compact"
                          onClick={async () => {
                            await api.admin.updateMember(m.id, { status: 'rejected' });
                            setMessage(t('admin.memberRejected', { email: m.email }));
                            load();
                          }}
                        >
                          {t('admin.rejectMember')}
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="btn-outline btn-compact"
                      onClick={async () => {
                        if (!(await confirmApply(t('admin.resetOtpConfirm', { email: m.email })))) return;
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
                        if (!(await confirmApply(t('admin.resetPwConfirm', { email: m.email })))) return;
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
          {filtered.length === 0 && <p className="muted-text empty-text">{t('admin.noMembers')}</p>}
        </div>
      )}
    </div>
  );
}
