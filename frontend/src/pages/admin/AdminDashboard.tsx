import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

type DayPoint = { date: string; value: number };
type StatusPoint = { key: string; value: number };

type DashStats = {
  totalUsers: number;
  pendingUsers: number;
  activeUsers: number;
  newUsers7d: number;
  totalPartners: number;
  totalOperators: number;
  totalOrgs: number;
  totalCards: number;
  activeCards: number;
  pendingKyc: number;
  totalBalance: number;
  estimatedRevenue: number;
  membersByDay: DayPoint[];
  partnersByDay: DayPoint[];
  cardsByStatus: StatusPoint[];
};

function handleAdminError(err: unknown) {
  const msg = (err as Error).message || '';
  if (msg.includes('Admin') || msg.includes('403')) {
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
  }
}

function MiniBars({ data, color }: { data: DayPoint[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hq-bars">
      {data.map((d) => (
        <div key={d.date} className="hq-bar-col" title={`${d.date}: ${d.value}`}>
          <div className="hq-bar" style={{ height: `${(d.value / max) * 120}px`, background: color }} />
          <span className="hq-bar-label">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  active: '#2f9e5f',
  inactive: '#9aa3af',
  blocked: '#d35b5b',
  closed: '#6b7280',
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin
      .getStats()
      .then((r) => setStats(r as DashStats))
      .catch((e) => {
        handleAdminError(e);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-dashboard">
      <div className="card-surface">
        <h3 className="section-title">{t('admin.titleDashboard')}</h3>
        {loading ? (
          <p className="muted-text">{t('common.loading')}</p>
        ) : stats ? (
          <div className="admin-stats-grid">
            <div className="stat-card">
              <div className="stat-label">{t('admin.statUsers')}</div>
              <div className="stat-value">{stats.totalUsers}</div>
              <Link to="/admin/customers" className="stat-link">{t('admin.viewDetails')}</Link>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('admin.statNewUsers')}</div>
              <div className="stat-value">{stats.newUsers7d}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('admin.statPendingUsers')}</div>
              <div className="stat-value">{stats.pendingUsers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('admin.statCards')}</div>
              <div className="stat-value">{stats.totalCards}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('admin.statActive')}</div>
              <div className="stat-value stat-success">{stats.activeCards}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('admin.statRevenue')}</div>
              <div className="stat-value">${(stats.estimatedRevenue ?? 0).toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('admin.statBalance')}</div>
              <div className="stat-value">${(stats.totalBalance ?? 0).toLocaleString()}</div>
              <Link to="/admin/cards" className="stat-link">{t('admin.viewCards')}</Link>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('admin.statPartners')}</div>
              <div className="stat-value">{stats.totalPartners}</div>
            </div>
          </div>
        ) : (
          <p className="muted-text">{t('admin.statsUnavailable')}</p>
        )}
      </div>

      {stats ? (
        <div className="hq-dash-grid">
          <div className="card-surface">
            <h3 className="section-title">{t('admin.chartNewMembers')}</h3>
            <MiniBars data={stats.membersByDay ?? []} color="#5b8def" />
          </div>
          <div className="card-surface">
            <h3 className="section-title">{t('admin.chartNewPartners')}</h3>
            <MiniBars data={stats.partnersByDay ?? []} color="#2f9e5f" />
          </div>
          <div className="card-surface">
            <h3 className="section-title">{t('admin.chartCardStatus')}</h3>
            <div className="hq-legend">
              {(stats.cardsByStatus?.length ? stats.cardsByStatus : [{ key: 'active', value: 0 }]).map((s) => (
                <span key={s.key}>
                  <i style={{ background: STATUS_COLOR[s.key] || '#9aa3af' }} />
                  {t(`cards.status.${s.key}`, { defaultValue: s.key })} · {s.value}
                </span>
              ))}
            </div>
          </div>
          <div className="card-surface">
            <h3 className="section-title">{t('admin.chartOps')}</h3>
            <dl className="hq-dl">
              <dt>{t('admin.statPendingKyc')}</dt>
              <dd>{stats.pendingKyc}</dd>
              <dt>{t('admin.navHqOperators')}</dt>
              <dd>{stats.totalOperators}</dd>
              <dt>{t('admin.navOrg')}</dt>
              <dd>{stats.totalOrgs}</dd>
              <dt>{t('admin.statusActive')}</dt>
              <dd>{stats.activeUsers}</dd>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
