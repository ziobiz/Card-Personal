import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type Staff = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function PartnerStaff() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Staff[]>([]);
  const [canAdd, setCanAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');
  const [message, setMessage] = useState('');

  const load = () => {
    api.partnerPortal
      .staff()
      .then((r) => {
        setItems(r.items);
        setCanAdd(Boolean(r.canAdd));
      })
      .catch((e) => setMessage((e as Error).message));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.partnerPortal.addStaff({ email, name, password, role });
      setEmail('');
      setName('');
      setPassword('');
      load();
      setMessage(t('admin.saved'));
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <div className="pp-card">
      <h1>{t('partner.navStaff')}</h1>
      <p className="muted-text">{t('partner.staffHint')}</p>
      {canAdd ? (
        <form onSubmit={create} className="hq-form-grid" style={{ marginBottom: 16 }}>
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
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
          </label>
          <label>
            {t('admin.operatorRole')}
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ADMIN">{t('admin.roleAdmin')}</option>
              <option value="STAFF">{t('admin.roleStaff')}</option>
            </select>
          </label>
          <button type="submit" className="btn-primary">{t('admin.register')}</button>
        </form>
      ) : (
        <p className="muted-text">{t('partner.staffNoAdd')}</p>
      )}
      {message ? <p className="muted-text">{message}</p> : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin.colEmail')}</th>
            <th>{t('admin.operatorName')}</th>
            <th>{t('admin.operatorRole')}</th>
            <th>{t('admin.colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id}>
              <td>{o.email}</td>
              <td>{o.name}</td>
              <td>{o.role === 'STAFF' ? t('admin.roleStaff') : t('admin.roleAdmin')}</td>
              <td>{o.status === 'suspended' ? t('admin.statusSuspended') : t('admin.statusActive')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
