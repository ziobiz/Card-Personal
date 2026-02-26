import { Link, useNavigate, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/admin/login');
  };

  return (
    <div className="layout admin-layout">
      <header className="layout-header admin-header">
        <Link to="/admin/dashboard" className="layout-brand">Wirex Card Admin</Link>
        <nav className="layout-nav">
          <Link to="/admin/dashboard" className="nav-link">대시보드</Link>
          <Link to="/admin/users" className="nav-link">사용자</Link>
          <Link to="/admin/cards" className="nav-link">카드</Link>
          <Link to="/admin/partners" className="nav-link">파트너 API</Link>
          <Link to="/admin/settings" className="nav-link">환경설정</Link>
          <button onClick={handleLogout} className="btn-logout">로그아웃</button>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
