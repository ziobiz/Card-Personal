import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

function handleAdminError(err: unknown) {
  const msg = (err as Error).message || '';
  if (msg.includes('Admin') || msg.includes('403')) {
    localStorage.removeItem('token');
    window.location.href = '/admin/login';
  }
}

export default function AdminDashboard() {
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
      <h1 className="page-title">관리자 대시보드</h1>
      {loading ? (
        <p className="muted-text">로딩 중...</p>
      ) : stats ? (
        <div className="admin-stats-grid">
          <div className="card-surface stat-card">
            <div className="stat-label">전체 사용자</div>
            <div className="stat-value">{stats.totalUsers}</div>
            <Link to="/admin/users" className="stat-link">상세 보기 →</Link>
          </div>
          <div className="card-surface stat-card">
            <div className="stat-label">전체 카드</div>
            <div className="stat-value">{stats.totalCards}</div>
          </div>
          <div className="card-surface stat-card">
            <div className="stat-label">활성 카드</div>
            <div className="stat-value stat-success">{stats.activeCards}</div>
          </div>
          <div className="card-surface stat-card">
            <div className="stat-label">총 카드 잔액 (USD)</div>
            <div className="stat-value">${stats.totalBalance.toLocaleString()}</div>
            <Link to="/admin/cards" className="stat-link">카드 목록 →</Link>
          </div>
        </div>
      ) : (
        <p className="muted-text">통계를 불러올 수 없습니다.</p>
      )}
    </div>
  );
}
