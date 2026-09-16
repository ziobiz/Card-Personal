import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import AdminAuthChrome from '../../components/AdminAuthChrome';
import { setAdminToken } from '../../lib/adminSession';

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
      const r = await api.admin.changePassword(password);
      sessionStorage.removeItem('adminMustChangePassword');
      if (r.mustSetupOtp && r.enrollToken) {
        sessionStorage.setItem('adminOtpEnroll', r.enrollToken);
        navigate('/admin/otp', { replace: true });
        return;
      }
      if (r.otpRequired && r.token) {
        setAdminToken(r.token);
        sessionStorage.removeItem('adminOtpEnroll');
        navigate('/admin/otp', { replace: true });
        return;
      }
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = Boolean(password.trim() && confirm.trim()) && !loading;

  return (
    <AdminAuthChrome>
      <h1 className="ac-title">{t('partner.setPassword')}</h1>
      <p className="ac-sub">{t('partner.setPasswordHint')}</p>
      <form onSubmit={handleSubmit}>
        {error ? <div className="ac-error">{error}</div> : null}
        <label className="ac-field">
          {t('auth.password')}
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </label>
        <label className="ac-field">
          {t('admin.passwordConfirm')}
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </label>
        <button type="submit" disabled={!canSubmit} className="ac-submit">
          {loading ? t('admin.saving') : t('common.confirm')}
        </button>
      </form>
    </AdminAuthChrome>
  );
}
