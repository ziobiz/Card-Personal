import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';

export default function AdminPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError(t('admin.passwordMin'));
      return;
    }
    if (password !== confirm) {
      setError(t('admin.passwordMismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.admin.changePassword(password);
      localStorage.removeItem('adminMustChangePassword');
      navigate('/admin/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <form className="admin-login-card card-surface" onSubmit={handleSubmit}>
        <h1>{t('partner.setPassword')}</h1>
        <p className="muted-text">{t('partner.setPasswordHint')}</p>
        {error ? <div className="auth-error">{error}</div> : null}
        <input className="input auth-input" type="password" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input className="input auth-input" type="password" placeholder={t('admin.passwordConfirm')} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <button type="submit" className="btn-primary" disabled={loading}>{t('common.confirm')}</button>
      </form>
    </div>
  );
}
