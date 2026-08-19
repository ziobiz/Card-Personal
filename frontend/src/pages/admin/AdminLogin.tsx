import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useBrand } from '../../brand/BrandContext';

export default function AdminLogin() {
  const { t } = useTranslation();
  const { brand } = useBrand();
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
      localStorage.setItem('token', r.token);
      if (r.mustChangePassword) {
        localStorage.setItem('adminMustChangePassword', '1');
        navigate('/admin/password');
        return;
      }
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
        <div className="auth-lang" style={{ marginBottom: '1rem' }}>
          <LanguageSwitcher admin />
        </div>
        <div className="admin-login-brand">
          {brand.logoAdmin ? <img src={brand.logoAdmin} alt="" /> : <strong>{brand.productName}</strong>}
        </div>
        <h1>{t('admin.loginTitle')}</h1>
        <p className="muted-text">{t('admin.loginSubtitle')}</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <input
            type="text"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input auth-input"
          />
          <input
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input auth-input"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>
        <p className="admin-login-footer">
          <a href="/login">{t('admin.userLogin')}</a>
        </p>
        <p className="wx-copy" style={{ marginTop: 16 }}>{brand.copyright}</p>
      </div>
    </div>
  );
}
