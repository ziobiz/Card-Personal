import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Operator = {
  id: string;
  email: string;
  name: string;
  scope: string;
  role: string;
  partnerId?: string;
  partnerName?: string;
  status: string;
  createdAt: string;
  groupId?: string;
  isSuper?: boolean;
};

type Group = { id: string; code: string; name: string };

export default function AdminOperators({ scope }: { scope: 'HQ' | 'PARTNER' }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Operator[]>([]);
  const [partners, setPartners] = useState<Array<{ id: string; name: string; companyName?: string }>>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [message, setMessage] = useState('');

  const load = () => {
    api.admin.getOperators(scope).then((r) => setItems(r.items)).catch(() => setItems([]));
  };

  useEffect(() => {
    load();
    if (scope === 'PARTNER') {
      api.admin.getPartners().then((r) => setPartners(r.items)).catch(() => setPartners([]));
    }
    api.admin
      .getAccessGroups(scope === 'HQ' ? 'HQ' : partnerId || 'HQ')
      .then((r) => {
        setGroups(r.items);
        setGroupId((id) => id || r.items.find((g) => g.code === 'general')?.id || r.items[0]?.id || '');
      })
      .catch(() => setGroups([]));
  }, [scope, partnerId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.admin.createOperator({
        email,
        name,
        password,
        scope,
        role,
        partnerId: scope === 'PARTNER' ? partnerId : undefined,
        groupId,
      });
      setEmail('');
      setName('');
      setPassword('');
      load();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <div>
      <p className="muted-text hq-card-hint">{scope === 'HQ' ? t('admin.operatorsHqDesc') : t('admin.operatorsPartnerDesc')}</p>
      <form onSubmit={create} className="card-surface" style={{ marginBottom: 12 }}>
        <h3 className="section-title">{t('admin.operatorAdd')}</h3>
        <div className="hq-form-grid">
          <label>
            {t('admin.colEmail')}
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {t('admin.operatorName')}
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t('admin.password')}
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label>
            {t('admin.operatorRole')}
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ADMIN">{t('admin.roleAdmin')}</option>
              <option value="STAFF">{t('admin.roleStaff')}</option>
            </select>
          </label>
          {scope === 'PARTNER' && (
            <label>
              {t('admin.colPartner')}
              <select className="input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} required>
                <option value="">{t('admin.filterAll')}</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.companyName || p.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t('access.groupLabel')}
            <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{t(`access.group.${g.code}`, { defaultValue: g.name })}</option>
              ))}
            </select>
          </label>
        </div>
        {message ? <p className="auth-error">{message}</p> : null}
        <div className="hq-toolbar" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" className="btn-primary">{t('admin.register')}</button>
        </div>
      </form>
      <div className="card-surface" style={{ padding: 0 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.colEmail')}</th>
              <th>{t('admin.operatorName')}</th>
              {scope === 'PARTNER' && <th>{t('admin.colPartner')}</th>}
              <th>{t('access.groupLabel')}</th>
              <th>{t('admin.operatorRole')}</th>
              <th>{t('admin.colStatus')}</th>
              <th>{t('admin.colJoined')}</th>
              <th>{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td>{o.email}</td>
                <td>{o.name}</td>
                {scope === 'PARTNER' && <td>{o.partnerName || o.partnerId || '-'}</td>}
                <td>{groups.find((g) => g.id === o.groupId)?.name || (o.isSuper ? t('access.super') : '-')}</td>
                <td>{o.role === 'STAFF' ? t('admin.roleStaff') : t('admin.roleAdmin')}</td>
                <td>
                  <select
                    className="admin-status-select"
                    value={o.status}
                    onChange={async (e) => {
                      await api.admin.updateOperator(o.id, { status: e.target.value });
                      load();
                    }}
                  >
                    <option value="active">{t('admin.statusActive')}</option>
                    <option value="suspended">{t('admin.statusSuspended')}</option>
                  </select>
                </td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    type="button"
                    className="btn-outline btn-compact"
                    onClick={async () => {
                      if (!window.confirm(t('admin.resetOtpConfirm', { email: o.email }))) return;
                      try {
                        await api.admin.resetOperatorOtp(o.id);
                        setMessage(t('admin.otpResetDone', { email: o.email }));
                      } catch (err) {
                        setMessage((err as Error).message);
                      }
                    }}
                  >
                    {t('admin.resetOtpBtn')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="muted-text empty-text">{t('admin.noOperators')}</p>}
      </div>
    </div>
  );
}
