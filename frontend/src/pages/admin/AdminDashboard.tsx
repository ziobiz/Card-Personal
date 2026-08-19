import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

function handleAdminError(err: unknown) {
  const msg = (err as Error).message || '';
  if (msg.includes('Admin') || msg.includes('403')) {
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
  }
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{ totalUsers: number; totalCards: number; activeCards: number; totalBalance: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin
      .getStats()
      .then(setStats)
      .catch((e) => {
        handleAdminError(e);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-container admin-dashboard">
      <h1 className="page-title">{t('admin.titleDashboard')}</h1>
      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : stats ? (
        <div className="admin-stats-grid">
          <div className="card-surface stat-card">
            <div className="stat-label">{t('admin.statUsers')}</div>
            <div className="stat-value">{stats.totalUsers}</div>
            <Link to="/admin/users" className="stat-link">{t('admin.viewDetails')}</Link>
          </div>
          <div className="card-surface stat-card">
            <div className="stat-label">{t('admin.statCards')}</div>
            <div className="stat-value">{stats.totalCards}</div>
          </div>
          <div className="card-surface stat-card">
            <div className="stat-label">{t('admin.statActive')}</div>
            <div className="stat-value stat-success">{stats.activeCards}</div>
          </div>
          <div className="card-surface stat-card">
            <div className="stat-label">{t('admin.statBalance')}</div>
            <div className="stat-value">${stats.totalBalance.toLocaleString()}</div>
            <Link to="/admin/cards" className="stat-link">{t('admin.viewCards')}</Link>
          </div>
        </div>
      ) : (
        <p className="muted-text">{t('admin.statsUnavailable')}</p>
      )}
    </div>
  );
}
