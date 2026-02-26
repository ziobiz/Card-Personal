import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

type User = { id: string; email: string; wirexUserId?: string; createdAt: string };

export default function AdminUsers() {
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
        <h1 className="page-title">사용자 관리</h1>
        <Link to="/admin/dashboard" className="btn-outline">← 대시보드</Link>
      </div>
      {loading ? (
        <p className="muted-text">로딩 중...</p>
      ) : (
        <div className="card-surface admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>이메일</th>
                <th>Wirex User ID</th>
                <th>가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td className="mono">{u.wirexUserId || '-'}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="muted-text empty-text">등록된 사용자가 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
