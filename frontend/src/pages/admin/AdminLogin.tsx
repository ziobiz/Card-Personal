import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.admin.login(email.trim(), password);
      localStorage.setItem('token', token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card card-surface">
        <h1>관리자 로그인</h1>
        <p className="muted-text">카드 시스템 관리자 전용</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input auth-input"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input auth-input"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <p className="admin-login-footer">
          <a href="/login">일반 사용자 로그인</a>
        </p>
      </div>
    </div>
  );
}
