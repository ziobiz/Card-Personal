import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type User = { id: string; email: string; wirexUserId?: string; createdAt: string; source?: string; partnerId?: string };

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin
      .getUsers()
      .then((r) => setUsers(r.items))
      .catch((e) => {
        const msg = (e as Error).message || '';
        if (msg.includes('Admin') || msg.includes('403')) {
          localStorage.removeItem('token');
          window.location.href = '/admin/login';
        }
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">{t('admin.titleUsers')}</h1>
        <Link to="/admin/dashboard" className="btn-outline">{t('admin.backDashboard')}</Link>
      </div>
      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.colEmail')}</th>
                <th>{t('admin.colChannel')}</th>
                <th>{t('admin.colWirexId')}</th>
                <th>{t('admin.colJoined')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.source === 'partner' ? t('admin.channelPartner') : t('admin.channelDirect')}</td>
                  <td className="mono">{u.wirexUserId || '-'}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="muted-text empty-text">{t('admin.noUsers')}</p>}
        </div>
      )}
      <p className="muted-text">{t('admin.directMemberDesc')}</p>
    </div>
  );
}
