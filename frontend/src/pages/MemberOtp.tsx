import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useBrand } from '../brand/BrandContext';
import './Auth.css';

export default function MemberOtp() {
  const { t } = useTranslation();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.auth.verifyOtp(code.trim());
      localStorage.setItem('token', r.token);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wx-auth">
      <header className="wx-auth-top">
        <span className="wx-mark">{brand.productName}</span>
        <LanguageSwitcher />
      </header>
      <form className="wx-auth-card" onSubmit={handleSubmit}>
        <h1>{t('partner.otpTitle')}</h1>
        <p className="auth-subtitle">{t('partner.otpHint')}</p>
        {error ? <div className="auth-error">{error}</div> : null}
        <input className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 12 }}>{t('common.confirm')}</button>
      </form>
    </div>
  );
}
