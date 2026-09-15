import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import AdminAuthChrome from '../../components/AdminAuthChrome';

export default function AdminLogin() {
  const { t } = useTranslation();
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
      const r = await api.admin.login(email.trim(), password);
      if (r.mustChangePassword && r.token) {
        localStorage.setItem('token', r.token);
        localStorage.setItem('adminMustChangePassword', '1');
        navigate('/admin/password');
        return;
      }
      if (r.mustSetupOtp && r.enrollToken) {
        sessionStorage.setItem('adminOtpEnroll', r.enrollToken);
        navigate('/admin/otp');
        return;
      }
      if (r.token) localStorage.setItem('token', r.token);
      if (r.otpRequired) {
        sessionStorage.removeItem('adminOtpEnroll');
        navigate('/admin/otp');
        return;
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = Boolean(email.trim() && password.trim()) && !loading;

  return (
    <AdminAuthChrome>
      <h1 className="ac-title">{t('auth.login')}</h1>
      <form onSubmit={handleSubmit}>
        {error ? <div className="ac-error">{error}</div> : null}
        <label className="ac-field">
          {t('auth.email')}
          <input
            type="text"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label className="ac-field">
          {t('auth.password')}
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="ac-submit" disabled={!canSubmit}>
          {loading ? t('auth.loggingIn') : t('auth.loginButton')}
        </button>
      </form>
    </AdminAuthChrome>
  );
}
